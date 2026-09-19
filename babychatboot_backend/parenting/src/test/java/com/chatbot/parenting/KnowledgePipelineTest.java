package com.chatbot.parenting;

import com.chatbot.parenting.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.pgvector.PgVectorStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real PostgreSQL and PgVectorStore; deterministic local embeddings, no Gemini calls. */
@EnabledIfEnvironmentVariable(named="ICARE_TEST_JDBC_URL", matches=".+")
class KnowledgePipelineTest {
    JdbcTemplate jdbc; TransactionTemplate transaction; VectorStore vectors; KnowledgeService service;
    final ObjectMapper json = new ObjectMapper(); final KnowledgeExtractor extractor = new KnowledgeExtractor();
    final AtomicInteger embedded = new AtomicInteger();
    final KnowledgeService.Metadata meta = new KnowledgeService.Metadata("Test guideline", "https://example.test/one", "Test publisher", "2026-01-01");
    @BeforeEach void setup() {
        String admin = System.getenv("ICARE_TEST_JDBC_URL");
        if (!admin.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/icare_validation")) throw new IllegalArgumentException("Validation DB only");
        String name = "icare_validation_" + UUID.randomUUID().toString().replace("-", "");
        String username = Objects.requireNonNull(System.getenv("ICARE_TEST_DB_USER")), password = Objects.requireNonNull(System.getenv("ICARE_TEST_DB_PASSWORD"));
        new JdbcTemplate(new DriverManagerDataSource(admin, username, password)).execute("CREATE DATABASE " + name);
        var ds = new DriverManagerDataSource(admin.substring(0, admin.lastIndexOf('/')+1) + name, username, password);
        jdbc = new JdbcTemplate(ds); transaction = new TransactionTemplate(new DataSourceTransactionManager(ds));
        var configuration = Flyway.configure().dataSource(ds).cleanDisabled(true).baselineOnMigrate(false)
                .locations("classpath:db/migration").placeholders(Map.of("vectorDimensions", "3072"));
        configuration.target("2").load().migrate();
        String literal = "[1," + "0,".repeat(3070) + "0]";
        jdbc.update("INSERT INTO vector_store(content,metadata,embedding) VALUES ('legacy preserved','{\"source\":\"legacy\"}'::json,?::vector)", literal);
        var before = jdbc.queryForList("SELECT id,content,metadata::text,embedding::text FROM vector_store");
        assertThat(configuration.target("3").load().migrate().migrationsExecuted).isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT id,content,metadata::text,embedding::text FROM vector_store")).isEqualTo(before);
        float[] vector = new float[3072]; vector[0] = 1;
        var embedding = mock(EmbeddingModel.class, invocation -> {
            if (invocation.getMethod().getName().equals("dimensions")) return 3072;
            if (invocation.getMethod().getName().equals("embed")) {
                Object input = invocation.getArgument(0);
                if (input instanceof List<?> list) { embedded.addAndGet(list.size()); return list.stream().map(v -> vector.clone()).toList(); }
                return vector.clone();
            }
            return RETURNS_DEFAULTS.answer(invocation);
        });
        vectors = PgVectorStore.builder(jdbc, embedding).dimensions(3072).initializeSchema(false)
                .distanceType(PgVectorStore.PgDistanceType.COSINE_DISTANCE).indexType(PgVectorStore.PgIndexType.NONE).build();
        service = new KnowledgeService(jdbc, vectors, json, new AiRequestGuard(4000, 1024, 10, new FakeRequestControl()));
    }
    Map<String,Object> ingest(KnowledgeService target, String text, KnowledgeService.Metadata metadata, String expected, boolean approved) {
        var parts = extractor.text(text); var preview = target.preview(parts, metadata);
        return transaction.execute(status -> target.ingest(parts, metadata, preview.hash(), expected, approved));
    }
    @Test void deduplicatesAddsNewSourcesAndOnlySearchesApprovedCurrentVersions() throws Exception {
        var first = ingest(service, "original reviewed text", meta, "", false);
        int count = embedded.get();
        assertThat(ingest(service, "original reviewed text", meta, "", false)).containsEntry("duplicate",true);
        assertThat(embedded.get()).isEqualTo(count);
        var other = new KnowledgeService.Metadata("Another", "https://example.test/two", "Publisher", "");
        ingest(service, "new source despite nonempty store", other, "", false);
        assertThatThrownBy(() -> ingest(service,"updated text",meta,first.get("version").toString(),false)).hasMessageContaining("409");
        assertThatThrownBy(() -> ingest(service,"updated text",meta,"stale",true)).hasMessageContaining("409");
        var replacement = ingest(service,"updated text",meta,first.get("version").toString(),true);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM knowledge_revision WHERE active",Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM vector_store",Integer.class)).isEqualTo(4);
        var context = new KnowledgeSearchService(vectors,json).search("test question",5);
        assertThat(context.text()).contains("updated text","new source").doesNotContain("original reviewed","legacy preserved");
        var sources = json.readTree(context.sourcesJson());
        assertThat(sources).hasSize(2);
        assertThat(context.sourcesJson()).contains(replacement.get("version").toString(),meta.sourceUrl());
        for (var source : sources) assertThat(context.text()).contains(source.get("excerpt").asText());
        assertThat(ingest(service,"original reviewed text",meta,replacement.get("version").toString(),true)).containsEntry("duplicate",true);
        assertThat(jdbc.queryForObject("SELECT active FROM knowledge_revision WHERE id=?::uuid",Boolean.class,first.get("version"))).isFalse();
    }
    @Test void partialVectorFailureRollsBackAndKeepsOldVersionSearchable() {
        var first = ingest(service,"previous stable text",meta,"",false);
        var before = jdbc.queryForList("SELECT id,content,metadata::text FROM vector_store ORDER BY id");
        VectorStore failing = mock(VectorStore.class);
        doAnswer(call -> { vectors.add(call.<List<Document>>getArgument(0)); throw new IllegalStateException("synthetic embedding failure after write"); }).when(failing).add(anyList());
        var failService = new KnowledgeService(jdbc,failing,json,new AiRequestGuard(4000, 1024, 10, new FakeRequestControl()));
        assertThatThrownBy(() -> ingest(failService,"new failed text",meta,first.get("version").toString(),true)).isInstanceOf(IllegalStateException.class);
        assertThat(jdbc.queryForList("SELECT id,content,metadata::text FROM vector_store ORDER BY id")).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM knowledge_revision",Integer.class)).isEqualTo(1);
        assertThat(new KnowledgeSearchService(vectors,json).search("test",5).text()).contains("previous stable text");
    }
    @Test void alteredPreviewCannotRegisterAndUniqueActiveConstraintProtectsVersions() {
        var parts = extractor.text("approved text"); var preview = service.preview(parts,meta);
        assertThatThrownBy(() -> transaction.execute(s -> service.ingest(extractor.text("changed text"),meta,preview.hash(),"",false))).isInstanceOf(IllegalArgumentException.class);
        assertThat(embedded.get()).isZero();
        ingest(service,"approved text",meta,"",false);
        assertThatThrownBy(() -> jdbc.update("INSERT INTO knowledge_revision(id,source_url,title,publisher,content_hash,active,chunk_count) VALUES (?::uuid,?,'test','test',?,true,1)",UUID.randomUUID().toString(),meta.sourceUrl(),"0".repeat(64))).isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test void approvedStartupManifestSkipsDuplicateButLoadsNewFile(@org.junit.jupiter.api.io.TempDir java.nio.file.Path folder) throws Exception {
        var metadata2 = new KnowledgeService.Metadata("Second", "https://example.test/startup-two", "Publisher", "");
        ingest(service,"already registered",meta,"",false);
        var firstPreview = service.preview(extractor.text("already registered"),meta);
        var secondPreview = service.preview(extractor.text("new startup document"),metadata2);
        java.nio.file.Files.createDirectories(folder.resolve("documents"));
        java.nio.file.Files.writeString(folder.resolve("documents/one.txt"),"already registered");
        java.nio.file.Files.writeString(folder.resolve("documents/two.txt"),"new startup document");
        var entries = new ArrayList<Map<String,Object>>();
        for (var pair : List.of(Map.entry("one.txt",firstPreview),Map.entry("two.txt",secondPreview))) {
            var preview = pair.getValue(); var metadata = preview.metadata();
            entries.add(Map.of("file",pair.getKey(),"title",metadata.title(),"sourceUrl",metadata.sourceUrl(),"publisher",metadata.publisher(),
                    "revisedOn",metadata.revisedOn(),"reviewedHash",preview.hash(),"expectedVersion",preview.currentVersion(),"replaceApproved",false));
        }
        java.nio.file.Files.write(folder.resolve("documents/approved-manifest.json"),json.writeValueAsBytes(entries));
        var proxy = new org.springframework.aop.framework.ProxyFactory(service); proxy.setProxyTargetClass(true);
        proxy.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(
                new DataSourceTransactionManager(jdbc.getDataSource()),new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        var bean = (KnowledgeService)proxy.getProxy();
        var loader = new KnowledgeLoaderService(extractor,bean,json);
        var thread = Thread.currentThread(); var originalLoader = thread.getContextClassLoader();
        try (var classLoader = new java.net.URLClassLoader(new java.net.URL[]{folder.toUri().toURL()}, originalLoader)) {
            thread.setContextClassLoader(classLoader);
            loader.run(new org.springframework.boot.DefaultApplicationArguments());
            int count = embedded.get();
            loader.run(new org.springframework.boot.DefaultApplicationArguments());
            assertThat(embedded.get()).isEqualTo(count);
        } finally { thread.setContextClassLoader(originalLoader); }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM knowledge_revision WHERE active",Integer.class)).isEqualTo(2);
        assertThat(new KnowledgeSearchService(vectors,json).search("test",5).text()).contains("new startup document","already registered");
    }
}
