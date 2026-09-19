package com.chatbot.parenting.controller;

import com.chatbot.parenting.service.KnowledgeExtractor;
import com.chatbot.parenting.service.KnowledgeService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/knowledge")
public class KnowledgeController {
    private final KnowledgeExtractor extractor;
    private final KnowledgeService knowledge;
    public record TextRequest(String content, String title, String sourceUrl, String publisher, String revisedOn,
            String reviewedHash, String expectedVersion, boolean replaceApproved,
            Integer minAgeMonths, Integer maxAgeMonths, String jurisdiction) {
        KnowledgeService.Metadata metadata() { return new KnowledgeService.Metadata(title, sourceUrl, publisher, revisedOn, minAgeMonths, maxAgeMonths, jurisdiction); }
    }
    @GetMapping public Object versions() { return knowledge.versions(); }
    @PostMapping("/preview") public Object preview(@RequestBody TextRequest request) {
        return knowledge.preview(extractor.text(request.content()), request.metadata());
    }
    @PostMapping public Object add(@RequestBody TextRequest request) {
        return knowledge.ingest(extractor.text(request.content()), request.metadata(), request.reviewedHash(), request.expectedVersion(), request.replaceApproved());
    }
    @PostMapping("/upload/preview") public Object previewFile(@RequestParam MultipartFile file, @RequestParam Map<String, String> values) {
        return knowledge.preview(extractor.file(file), metadata(values));
    }
    @PostMapping("/upload") public Object upload(@RequestParam MultipartFile file, @RequestParam Map<String, String> values) {
        return knowledge.ingest(extractor.file(file), metadata(values), values.get("reviewedHash"), values.get("expectedVersion"), Boolean.parseBoolean(values.get("replaceApproved")));
    }
    private KnowledgeService.Metadata metadata(Map<String, String> values) {
        return new KnowledgeService.Metadata(values.get("title"), values.get("sourceUrl"), values.get("publisher"), values.get("revisedOn"),
                month(values.get("minAgeMonths")), month(values.get("maxAgeMonths")), values.get("jurisdiction"));
    }
    private Integer month(String value) {
        if (value == null || value.isBlank()) return null;
        try { return Integer.valueOf(value); }
        catch (NumberFormatException e) { throw new IllegalArgumentException("월령은 정수로 입력하세요."); }
    }
}
