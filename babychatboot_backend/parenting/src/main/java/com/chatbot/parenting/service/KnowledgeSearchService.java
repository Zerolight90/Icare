package com.chatbot.parenting.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class KnowledgeSearchService {
    private final VectorStore vectors;
    private final ObjectMapper json;
    @org.springframework.beans.factory.annotation.Value("${icare.knowledge.min-similarity:0.45}")
    private double minSimilarity = 0.45;
    @org.springframework.beans.factory.annotation.Value("${icare.knowledge.daily-source-urls:}")
    private String dailySourceUrls = "";
    @jakarta.annotation.PostConstruct
    void validateThreshold() {
        if (!Double.isFinite(minSimilarity) || minSimilarity < 0 || minSimilarity > 1)
            throw new IllegalArgumentException("검색 유사도는 0~1 사이여야 합니다.");
    }
    public record Evidence(String title, String url, String publisher, String revisedOn, String version, int page, String excerpt,
            String jurisdiction, Integer minAgeMonths, Integer maxAgeMonths) { }
    public record Context(String text, String sourcesJson, int sourceCount) { }
    public Context search(String question, int topK) {
        return search(question, topK, null);
    }
    public Context search(String question, int topK, Integer ageMonths) {
        return search(question, topK, ageMonths, List.of());
    }
    public Context searchDailyLog(String question, int ageMonths) {
        var allowed = Arrays.stream(dailySourceUrls.split(",")).map(String::strip).filter(s -> !s.isEmpty()).distinct().toList();
        if (allowed.isEmpty()) return new Context("", "[]", 0);
        if (allowed.size() > 10 || allowed.stream().anyMatch(url -> url.length() > 2000 || url.contains("'") || url.contains("\\")
                || !url.startsWith("https://") || url.chars().anyMatch(Character::isISOControl)))
            throw new IllegalArgumentException("일과표 검색 출처 설정을 확인하세요.");
        return search(question, 5, ageMonths, allowed);
    }
    private Context search(String question, int topK, Integer ageMonths, List<String> allowed) {
        if (ageMonths != null && (ageMonths < 0 || ageMonths > 216)) return new Context("", "[]", 0);
        String filter = "icare_managed == true && icare_active == true";
        if (ageMonths != null) filter += " && min_age_months <= " + ageMonths + " && max_age_months >= " + ageMonths;
        if (!allowed.isEmpty()) filter += " && source_url in [" + allowed.stream().map(url -> "'" + url + "'").collect(java.util.stream.Collectors.joining(",")) + "]";
        var documents = vectors.similaritySearch(SearchRequest.builder().query(question).topK(Math.max(1, Math.min(5, topK)))
                .similarityThreshold(minSimilarity).filterExpression(filter).build());
        var evidence = new ArrayList<Evidence>(); var context = new StringBuilder();
        if (documents != null) for (var document : documents) {
            var meta = document.getMetadata();
            if (!Boolean.TRUE.equals(meta.get("icare_managed")) || !Boolean.TRUE.equals(meta.get("icare_active"))) continue;
            Integer min = number(meta, "min_age_months"), max = number(meta, "max_age_months");
            if (ageMonths != null && (min == null || max == null || ageMonths < min || ageMonths > max)) continue;
            if (document.getScore() != null && document.getScore() < minSimilarity) continue;
            String url = string(meta, "source_url", 2000);
            if (!allowed.isEmpty() && !allowed.contains(url)) continue;
            try { var uri = URI.create(url); if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) continue; }
            catch (IllegalArgumentException e) { continue; }
            String header = "[자료 " + (evidence.size() + 1) + "] " + string(meta, "source", 200)
                    + " (지역: " + string(meta, "jurisdiction", 20) + ", 대상: "
                    + (min == null ? "미확인" : min + "~" + max + "개월") + ")\n";
            String text = document.getText(); int remaining = 4000 - context.length() - header.length() - 1;
            if (text == null || text.isBlank() || remaining < 1 || evidence.size() >= 5) continue;
            String excerpt = text.substring(0, Math.min(text.length(), remaining));
            evidence.add(new Evidence(string(meta,"source",200), url, string(meta,"publisher",200), string(meta,"revised_on",10),
                    string(meta,"icare_version",36), meta.get("page") instanceof Number n ? n.intValue() : 0, excerpt,
                    string(meta, "jurisdiction", 20), min, max));
            context.append(header).append(excerpt).append('\n');
        }
        try { return new Context(context.toString(), json.writeValueAsString(evidence), evidence.size()); }
        catch (Exception e) { throw new IllegalStateException("검색 근거 저장 형식 오류", e); }
    }
    private Integer number(Map<String,Object> metadata, String key) {
        return metadata.get(key) instanceof Number n ? n.intValue() : null;
    }
    private String string(Map<String,Object> metadata, String key, int max) {
        Object value = metadata.get(key); if (!(value instanceof String text)) return "";
        return text.substring(0, Math.min(max, text.length()));
    }
}
