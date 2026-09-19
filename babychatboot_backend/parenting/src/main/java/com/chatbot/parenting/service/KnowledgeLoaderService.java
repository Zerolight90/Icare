package com.chatbot.parenting.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Only a reviewed manifest can enable ingestion. Existing vectors never suppress unrelated new files. */
@Component
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "icare.knowledge.load-on-startup", havingValue = "true")
public class KnowledgeLoaderService implements ApplicationRunner {
    private final KnowledgeExtractor extractor;
    private final KnowledgeService knowledge;
    private final ObjectMapper json;

    @Override public void run(ApplicationArguments args) throws Exception {
        var manifest = new ClassPathResource("documents/approved-manifest.json");
        if (!manifest.exists()) throw new IllegalStateException("자동 등록에는 검토한 documents/approved-manifest.json이 필요합니다.");
        try (var stream = manifest.getInputStream()) {
            byte[] bytes = stream.readNBytes(65537);
            if (bytes.length > 65536) throw new IllegalArgumentException("문서 등록 목록이 너무 큽니다.");
            var entries = json.readTree(bytes);
            if (!entries.isArray() || entries.size() > 5) throw new IllegalArgumentException("자동 등록은 한 번에 최대 5개입니다.");
            for (var entry : entries) {
                String name = entry.path("file").asText();
                if (!name.matches("[A-Za-z0-9가-힣_. -]+\\.(pdf|docx|txt|md|csv)") || name.contains(".."))
                    throw new IllegalArgumentException("등록 파일명은 documents 안의 파일이어야 합니다.");
                var resource = new ClassPathResource("documents/" + name);
                try (var content = resource.getInputStream()) {
                    byte[] data = content.readNBytes(2 * 1024 * 1024 + 1);
                    var file = new org.springframework.web.multipart.MultipartFile() {
                        public String getName() { return "file"; }
                        public String getOriginalFilename() { return name; }
                        public String getContentType() { return "application/octet-stream"; }
                        public boolean isEmpty() { return data.length == 0; }
                        public long getSize() { return data.length; }
                        public byte[] getBytes() { return data; }
                        public java.io.InputStream getInputStream() { return new java.io.ByteArrayInputStream(data); }
                        public void transferTo(java.io.File dest) { throw new UnsupportedOperationException(); }
                    };
                    var metadata = new KnowledgeService.Metadata(entry.path("title").asText(), entry.path("sourceUrl").asText(),
                            entry.path("publisher").asText(), entry.path("revisedOn").asText(),
                            entry.hasNonNull("minAgeMonths") ? entry.get("minAgeMonths").asInt(-1) : null,
                            entry.hasNonNull("maxAgeMonths") ? entry.get("maxAgeMonths").asInt(-1) : null,
                            entry.path("jurisdiction").asText("UNSPECIFIED"));
                    knowledge.ingest(extractor.file(file), metadata, entry.path("reviewedHash").asText(),
                            entry.path("expectedVersion").asText(), entry.path("replaceApproved").asBoolean(false));
                }
            }
            log.info("검토한 문서 목록 {}개 처리 완료", entries.size());
        }
    }
}
