package com.chatbot.parenting.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Explicit operator-only import; no document assets or credentials are bundled in the application. */
@Component
@ConditionalOnProperty(name = "icare.knowledge.batch-enabled", havingValue = "true")
public class KnowledgeBatchRunner implements ApplicationRunner {
    private final KnowledgeService knowledge;
    private final KnowledgeExtractor extractor;
    private final ObjectMapper json;
    private final Path input, output;
    private final boolean apply;
    public KnowledgeBatchRunner(KnowledgeService knowledge, KnowledgeExtractor extractor, ObjectMapper json,
            @Value("${icare.knowledge.batch-input}") String input,
            @Value("${icare.knowledge.batch-output}") String output,
            @Value("${icare.knowledge.batch-apply:false}") boolean apply) {
        this.knowledge = knowledge; this.extractor = extractor; this.json = json;
        this.input = Path.of(input); this.output = Path.of(output); this.apply = apply;
    }
    public record Entry(String content, KnowledgeService.Metadata metadata, String reviewedHash,
            String expectedVersion, boolean replaceApproved, boolean reviewed) { }
    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void closeAfterBatch(org.springframework.boot.context.event.ApplicationReadyEvent event) {
        // This explicit one-shot process must not leave another backend running.
        event.getApplicationContext().close();
    }
    @Override public void run(ApplicationArguments arguments) throws Exception {
        if (Files.exists(output)) throw new IllegalArgumentException("등록 결과 파일은 새 경로를 지정하세요.");
        byte[] bytes;
        try (var stream = Files.newInputStream(input)) { bytes = stream.readNBytes(262145); }
        if (bytes.length > 262144) throw new IllegalArgumentException("등록 목록은 256KiB 이내여야 합니다.");
        var entries = json.readValue(bytes, Entry[].class);
        if (entries.length < 1 || entries.length > 5) throw new IllegalArgumentException("한 번에 1~5개 문서를 검토하세요.");
        var previews = new ArrayList<KnowledgeService.Preview>();
        var seen = new HashSet<String>();
        // Validate the entire batch before any embedding call or mutation.
        for (var entry : entries) {
            if (entry.metadata() == null || !seen.add(entry.metadata().sourceUrl()))
                throw new IllegalArgumentException("출처가 없거나 같은 출처가 반복됩니다.");
            var preview = knowledge.preview(extractor.text(entry.content()), entry.metadata());
            if (apply && (!entry.reviewed() || !preview.hash().equals(entry.reviewedHash())
                    || !preview.currentVersion().equals(entry.expectedVersion() == null ? "" : entry.expectedVersion())
                    || (!preview.currentVersion().isEmpty() && !preview.duplicate() && !entry.replaceApproved())))
                throw new IllegalArgumentException("전체 목록의 검토 해시·현재 버전·교체 승인을 확인하세요.");
            previews.add(preview);
        }
        // CREATE_NEW reserves the report before writes; a partial failure remains visible in this journal.
        try (var report = Files.newBufferedWriter(output, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)) {
            for (int i = 0; i < entries.length; i++) {
                var entry = entries[i];
                Object result = apply ? knowledge.ingest(extractor.text(entry.content()), entry.metadata(), entry.reviewedHash(),
                        entry.expectedVersion(), entry.replaceApproved()) : previews.get(i);
                report.write(json.writeValueAsString(Map.of("sourceUrl", entry.metadata().sourceUrl(), "applied", apply, "result", result)));
                report.newLine(); report.flush();
            }
        }
    }
}
