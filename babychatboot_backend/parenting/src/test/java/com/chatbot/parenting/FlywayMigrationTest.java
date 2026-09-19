package com.chatbot.parenting;

import com.chatbot.parenting.config.VectorSchemaValidator;
import com.chatbot.parenting.domain.*;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.JdbcTemplateAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;

import java.util.*;

import static org.assertj.core.api.Assertions.*;

/** Explicit opt-in, loopback-only PostgreSQL tests. Never reads application-secret.yml. */
@EnabledIfEnvironmentVariable(named = "ICARE_TEST_JDBC_URL", matches = ".+")
class FlywayMigrationTest {
    private static String adminUrl;
    private static String username;
    private static String password;
    private static final Class<?>[] ENTITIES = { Admin.class, Baby.class, Board.class,
            Category.class, ChatbotConfig.class, ChatMessage.class, ChatRoom.class,
            CommunityComment.class, CommunityPost.class, DailyLog.class, Family.class,
            Notice.class, com.chatbot.parenting.domain.Record.class, User.class };
    private static final List<String> TABLES = List.of("admins", "babies", "boards", "categories",
            "chatbot_config", "chat_messages", "chat_room", "community_comments", "community_posts",
            "daily_logs", "families", "notices", "records", "users", "vector_store");

    @BeforeAll
    static void guardTarget() {
        adminUrl = System.getenv("ICARE_TEST_JDBC_URL");
        if (!adminUrl.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/icare_validation")) {
            throw new IllegalArgumentException("Tests require a loopback icare_validation database; no connection made.");
        }
        username = Objects.requireNonNull(System.getenv("ICARE_TEST_DB_USER"));
        password = Objects.requireNonNull(System.getenv("ICARE_TEST_DB_PASSWORD"));
    }

    private static JdbcTemplate jdbc(String url) {
        return new JdbcTemplate(new DriverManagerDataSource(url, username, password));
    }

    private static String database() {
        String name = "icare_validation_" + UUID.randomUUID().toString().replace("-", "");
        jdbc(adminUrl).execute("CREATE DATABASE " + name);
        // Retained for review/pg_dump restore verification. Never drop or clean a user database.
        return adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + name;
    }

    private static Flyway flyway(String url, int dimensions) {
        return Flyway.configure().dataSource(url, username, password)
                .locations("classpath:db/migration").cleanDisabled(true).baselineOnMigrate(false)
                .baselineVersion("1").placeholders(Map.of("vectorDimensions", "" + dimensions)).load();
    }

    private static org.hibernate.SessionFactory sessionFactory(String url, String action) {
        Configuration config = new Configuration();
        for (Class<?> entity : ENTITIES) config.addAnnotatedClass(entity);
        config.setProperty("hibernate.connection.url", url);
        config.setProperty("hibernate.connection.username", username);
        config.setProperty("hibernate.connection.password", password);
        config.setProperty("hibernate.hbm2ddl.auto", action);
        config.setProperty("hibernate.physical_naming_strategy",
                "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");
        return config.buildSessionFactory();
    }

    private static void hibernate(String url, String action) {
        try (var ignored = sessionFactory(url, action)) { }
    }

    private static Map<String, Object> v1Snapshot(String url) {
        var result = snapshot(url);
        result.put("chat_room", jdbc(url).queryForObject("SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'context_version' - 'context_family_id' - 'context_baby_id' ORDER BY id)::text, '[]') FROM chat_room t", String.class));
        result.put("chat_messages", jdbc(url).queryForObject("SELECT COALESCE(jsonb_agg(to_jsonb(t) - 'retrieval_sources' ORDER BY id)::text, '[]') FROM chat_messages t", String.class));
        return result;
    }

    private static void validateVector(String url, int dimensions) {
        new VectorSchemaValidator(jdbc(url), dimensions, "public", "vector_store").afterPropertiesSet();
    }

    private static void legacySchema(String url, int dimensions) {
        hibernate(url, "create");
        jdbc(url).execute("CREATE EXTENSION vector");
        jdbc(url).execute("CREATE EXTENSION hstore");
        jdbc(url).execute("CREATE EXTENSION \"uuid-ossp\"");
        jdbc(url).execute("CREATE TABLE vector_store (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, "
                + "content text, metadata json, embedding vector(" + dimensions + "))");
    }

    private static List<Map<String, Object>> columns(String url) {
        return jdbc(url).queryForList("""
            SELECT table_name, column_name, data_type, udt_name, is_nullable,
                   character_maximum_length, numeric_precision, numeric_scale,
                   datetime_precision, column_default, is_identity, identity_generation
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name <> 'flyway_schema_history'
            ORDER BY table_name, column_name
            """);
    }

    private static List<Map<String, Object>> constraints(String url) {
        return jdbc(url).queryForList("""
            SELECT c.relname, con.contype, pg_get_constraintdef(con.oid) AS definition
            FROM pg_constraint con JOIN pg_class c ON con.conrelid = c.oid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname <> 'flyway_schema_history'
            ORDER BY c.relname, con.contype, definition
            """);
    }

    private static Map<String, Object> snapshot(String url) {
        var result = new TreeMap<String, Object>();
        for (String table : TABLES) {
            result.put(table, jdbc(url).queryForObject(
                    "SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text, '[]') FROM " + table + " t", String.class));
        }
        for (String sequence : jdbc(url).queryForList(
                "SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename", String.class)) {
            if (!sequence.matches("[a-z_]+")) throw new IllegalStateException("Unexpected sequence name");
            result.put(sequence, jdbc(url).queryForMap("SELECT last_value, is_called FROM " + sequence));
        }
        return result;
    }

    private static List<Map<String, Object>> roleCheckResults(String url) {
        var checks = constraints(url).stream().filter(c -> "c".equals(c.get("contype")) && "chat_messages".equals(c.get("relname"))).toList();
        assertThat(checks).extracting(c -> c.get("relname")).containsExactly("chat_messages");
        String expression = jdbc(url).queryForObject("""
            SELECT pg_get_expr(conbin, conrelid) FROM pg_constraint
            WHERE conrelid = 'public.chat_messages'::regclass AND contype = 'c'
            """, String.class);
        // pg_dump may move varchar/text casts within ANY(array). Compare the constraint's
        // behavior, not its printed expression. The expression comes from our synthetic DB.
        return jdbc(url).queryForList("SELECT role, (" + expression + ") AS allowed FROM "
                + "(VALUES ('USER'::varchar),('ASSISTANT'),('SYSTEM'),('ADMIN'),(''),('user'),(NULL)) "
                + "AS candidate(role) ORDER BY role NULLS FIRST");
    }

    private static void seed(String url, int dimensions) {
        var sql = jdbc(url);
        sql.execute("INSERT INTO families(invite_code) VALUES ('TEST01')");
        sql.execute("INSERT INTO users(email,provider,email_verified,name,nickname,role,family_id) "
                + "VALUES ('fixture@example.invalid','LOCAL',true,'fixture','fixture','MOM',1)");
        sql.execute("INSERT INTO babies(name,gender,birth_date,family_id) VALUES ('fixture','F','2026-01-01',1)");
        sql.execute("INSERT INTO admins(username,password,name) VALUES ('fixture','synthetic-hash','fixture')");
        sql.execute("INSERT INTO boards(name,board_type,active) VALUES ('fixture','COMMUNITY',true)");
        sql.execute("INSERT INTO categories(name) VALUES ('fixture')");
        sql.execute("INSERT INTO chatbot_config(config_key,config_value) VALUES ('system_prompt','synthetic prompt')");
        sql.execute("INSERT INTO chat_room(id,user_id,is_active) VALUES ('fixture-room',1,true)");
        sql.execute("INSERT INTO chat_messages(room_id,role,content,token_count) VALUES ('fixture-room','USER','fixture',0)");
        sql.execute("INSERT INTO daily_logs(record_time,baby_id,user_id,memo) VALUES ('2026-01-02 00:00:00',1,1,'fixture')");
        sql.execute("INSERT INTO records(record_type,baby_id,user_id) VALUES ('FEEDING',1,1)");
        sql.execute("INSERT INTO community_posts(title,content,board_id,user_id,view_count,comment_count) "
                + "VALUES ('fixture','fixture',1,1,0,0)");
        sql.execute("INSERT INTO community_comments(content,post_id,user_id) VALUES ('fixture',1,1)");
        sql.execute("INSERT INTO notices(title,content,pinned,active,author_id) VALUES ('fixture','fixture',false,true,1)");
        String vector = "[1," + "0,".repeat(dimensions - 2) + "0]";
        sql.update("INSERT INTO vector_store(content,metadata,embedding) VALUES (?,?::json,?::vector)",
                "synthetic document", "{\"source\":\"fixture\",\"revision\":\"2026-01-01\"}", vector);
    }

    @org.springframework.context.annotation.Configuration(proxyBeanMethods = false)
    @EntityScan(basePackageClasses = User.class)
    @Import(VectorSchemaValidator.class)
    static class PersistenceOnly { }

    @Test
    void applicationPropertiesInitializeFlywayBeforeJpaAndVectorValidation() {
        String url = database();
        new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(DataSourceAutoConfiguration.class,
                        JdbcTemplateAutoConfiguration.class, FlywayAutoConfiguration.class,
                        HibernateJpaAutoConfiguration.class))
                .withUserConfiguration(PersistenceOnly.class)
                .withInitializer(context -> {
                    var loader = new YamlPropertySourceLoader();
                    // Explicit files only: never import application-secret.yml or launch the application.
                    for (String file : List.of("application-dev.yml", "application.yml")) {
                        try {
                            for (var source : loader.load(file, new ClassPathResource(file))) {
                                context.getEnvironment().getPropertySources().addLast(source);
                            }
                        } catch (java.io.IOException e) { throw new java.io.UncheckedIOException(e); }
                    }
                })
                .withPropertyValues("spring.datasource.url=" + url,
                        "spring.datasource.username=" + username, "spring.datasource.password=" + password,
                        "spring.jpa.show-sql=false")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(VectorSchemaValidator.class);
                    var config = context.getBean(Flyway.class).getConfiguration();
                    assertThat(config.isBaselineOnMigrate()).isFalse();
                    assertThat(config.isCleanDisabled()).isTrue();
                    assertThat(config.getPlaceholders()).containsEntry("vectorDimensions", "3072");
                    assertThat(jdbc(url).queryForObject("SELECT count(*) FROM users", Integer.class)).isZero();
                });
    }

    @Test
    void emptyDatabaseMatchesIndependentHibernateSchema() {
        String fresh = database();
        assertThat(flyway(fresh, 3072).migrate().migrationsExecuted).isEqualTo(3);
        hibernate(fresh, "validate");
        validateVector(fresh, 3072);
        String legacy = database();
        legacySchema(legacy, 3072);
        // knowledge_revision is JDBC-managed and verified by KnowledgePipelineTest; compare all JPA tables independently.
        assertThat(columns(fresh).stream().filter(c -> !"knowledge_revision".equals(c.get("table_name"))).toList()).isEqualTo(columns(legacy));
        assertThat(constraints(fresh).stream().filter(c -> !"knowledge_revision".equals(c.get("relname"))).toList()).isEqualTo(constraints(legacy));
        seed(fresh, 3072);
        var before = snapshot(fresh);
        assertThat(flyway(fresh, 3072).migrate().migrationsExecuted).isZero();
        assertThatThrownBy(() -> flyway(fresh, 3072).clean()).isInstanceOf(FlywayException.class);
        assertThat(snapshot(fresh)).isEqualTo(before);
    }

    @Test
    void explicitBaselinePreservesAllRowsVectorsAndIdentitySequences() {
        String legacy = database();
        legacySchema(legacy, 3072);
        jdbc(legacy).execute("ALTER TABLE chat_room DROP COLUMN context_version, DROP COLUMN context_family_id, DROP COLUMN context_baby_id");
        jdbc(legacy).execute("ALTER TABLE chat_messages DROP COLUMN retrieval_sources");
        seed(legacy, 3072);
        var before = v1Snapshot(legacy);
        assertThatThrownBy(() -> flyway(legacy, 3072).migrate()).isInstanceOf(FlywayException.class);
        assertThat(v1Snapshot(legacy)).isEqualTo(before);
        assertThatThrownBy(() -> hibernate(legacy, "validate")).isInstanceOf(Exception.class);
        validateVector(legacy, 3072);
        flyway(legacy, 3072).baseline();
        assertThat(flyway(legacy, 3072).migrate().migrationsExecuted).isEqualTo(2);
        hibernate(legacy, "validate");
        assertThat(v1Snapshot(legacy)).isEqualTo(before);
        assertThat(jdbc(legacy).queryForObject("SELECT type FROM flyway_schema_history WHERE version='1'", String.class))
                .isEqualTo("BASELINE");
        assertThat(jdbc(legacy).queryForObject("INSERT INTO families(invite_code) VALUES ('TEST02') RETURNING id", Long.class))
                .isEqualTo(2L);
    }

    @Test
    void v1UpgradePreservesDataAndBoundsOwnerHistoryQuery() {
        String url = database();
        var v1 = Flyway.configure().configuration(flyway(url, 3072).getConfiguration()).target("1").load();
        assertThat(v1.migrate().migrationsExecuted).isEqualTo(1);
        seed(url, 3072);
        var before = v1Snapshot(url);
        assertThat(flyway(url, 3072).migrate().migrationsExecuted).isEqualTo(2);
        assertThat(v1Snapshot(url)).isEqualTo(before);
        assertThat(jdbc(url).queryForObject("SELECT context_version FROM chat_room WHERE id='fixture-room'", Integer.class)).isZero();
        assertThat(jdbc(url).queryForObject("SELECT context_family_id IS NULL AND context_baby_id IS NULL FROM chat_room WHERE id='fixture-room'", Boolean.class)).isTrue();
        assertThat(jdbc(url).queryForObject("SELECT checksum FROM flyway_schema_history WHERE version='1'", Integer.class)).isEqualTo(691030920);
        hibernate(url, "validate"); validateVector(url, 3072);
        jdbc(url).execute("INSERT INTO chat_messages(room_id,role,content,token_count) SELECT 'fixture-room', CASE WHEN i % 2 = 0 THEN 'ASSISTANT' ELSE 'USER' END, 'turn-'||i, 0 FROM generate_series(1,20) i");
        jdbc(url).update("INSERT INTO chat_messages(room_id,role,content,token_count) VALUES ('fixture-room','ASSISTANT',?,0)", "x".repeat(5000));
        jdbc(url).execute("INSERT INTO chat_messages(room_id,role,content,token_count) VALUES ('fixture-room','SYSTEM','never expose',0)");
        try (var factory = sessionFactory(url, "validate"); var session = factory.openSession()) {
            var repository = new org.springframework.data.jpa.repository.support.JpaRepositoryFactory(session)
                    .getRepository(com.chatbot.parenting.repository.ChatMessageRepository.class);
            var roles = List.of(ChatMessage.RoleType.USER, ChatMessage.RoleType.ASSISTANT);
            var page = org.springframework.data.domain.PageRequest.of(0, 12);
            var recent = repository.findRecentForOwner("fixture-room", "fixture@example.invalid", roles, page);
            assertThat(recent).hasSize(12);
            assertThat(recent.get(0).getContent()).hasSize(2001);
            assertThat(recent.get(1).getContent()).isEqualTo("turn-20");
            assertThat(recent).noneMatch(row -> row.getRole() == ChatMessage.RoleType.SYSTEM);
            assertThat(repository.findRecentForOwner("fixture-room", "outsider@example.invalid", roles, page)).isEmpty();
            assertThat(repository.findRecentForOwner("other-room", "fixture@example.invalid", roles, page)).isEmpty();
        }
    }

    @Test
    void dimensionsRemainProfileSpecificAndWrongProfileFailsWithoutChangingVectors() {
        String fresh = database();
        flyway(fresh, 768).migrate();
        hibernate(fresh, "validate");
        seed(fresh, 768);
        validateVector(fresh, 768);
        var before = snapshot(fresh);
        assertThatThrownBy(() -> validateVector(fresh, 3072)).isInstanceOf(IllegalStateException.class);
        assertThat(snapshot(fresh)).isEqualTo(before);
    }

    @Test
    void hibernateRejectsAnIncompatibleExistingColumn() {
        String drift = database();
        legacySchema(drift, 3072);
        jdbc(drift).execute("ALTER TABLE daily_logs ALTER COLUMN formula_amount TYPE text");
        assertThatThrownBy(() -> hibernate(drift, "validate")).isInstanceOf(Exception.class);
        assertThat(jdbc(drift).queryForObject("SELECT to_regclass('public.flyway_schema_history') IS NULL", Boolean.class)).isTrue();
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "ICARE_TEST_RESTORED_DB", matches = "icare_validation_[a-z0-9_]+")
    void logicalBackupRoundTripPreservesSchemaDataAndVectors() {
        String source = System.getenv("ICARE_TEST_BACKUP_SOURCE_DB");
        String restored = System.getenv("ICARE_TEST_RESTORED_DB");
        if (source == null || !source.matches("icare_validation_[a-z0-9_]+") || source.equals(restored)) {
            throw new IllegalArgumentException("Two distinct validation databases are required.");
        }
        String base = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1);
        assertThat(columns(base + restored)).isEqualTo(columns(base + source));
        assertThat(constraints(base + restored).stream().filter(c -> !"c".equals(c.get("contype"))).toList())
                .isEqualTo(constraints(base + source).stream().filter(c -> !"c".equals(c.get("contype"))).toList());
        assertThat(roleCheckResults(base + restored)).isEqualTo(roleCheckResults(base + source));
        assertThat(snapshot(base + restored)).isEqualTo(snapshot(base + source));
        hibernate(base + restored, "validate");
        validateVector(base + restored, 3072);
        flyway(base + restored, 3072).validate();
    }
}
