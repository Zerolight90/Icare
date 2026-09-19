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
    public record Evidence(String title, String url, String publisher, String revisedOn, String version, int page, String excerpt) { }
    public record Context(String text, String sourcesJson) { }
    public Context search(String question, int topK) {
        var documents = vectors.similaritySearch(SearchRequest.builder().query(question).topK(Math.max(1, Math.min(5, topK)))
                .filterExpression("icare_managed == true && icare_active == true").build());
        var evidence = new ArrayList<Evidence>(); var context = new StringBuilder();
        if (documents != null) for (var document : documents) {
            var meta = document.getMetadata();
            if (!Boolean.TRUE.equals(meta.get("icare_managed")) || !Boolean.TRUE.equals(meta.get("icare_active"))) continue;
            String url = string(meta, "source_url", 2000);
            try { var uri = URI.create(url); if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) continue; }
            catch (IllegalArgumentException e) { continue; }
            String text = document.getText(); int remaining = 4000 - context.length() - 10;
            if (text == null || text.isBlank() || remaining < 1 || evidence.size() >= 5) continue;
            String excerpt = text.substring(0, Math.min(text.length(), remaining));
            evidence.add(new Evidence(string(meta,"source",200), url, string(meta,"publisher",200), string(meta,"revised_on",10),
                    string(meta,"icare_version",36), meta.get("page") instanceof Number n ? n.intValue() : 0, excerpt));
            context.append("[자료 ").append(evidence.size()).append("]\n").append(excerpt).append('\n');
        }
        try { return new Context(context.toString(), json.writeValueAsString(evidence)); }
        catch (Exception e) { throw new IllegalStateException("검색 근거 저장 형식 오류", e); }
    }
    private String string(Map<String,Object> metadata, String key, int max) {
        Object value = metadata.get(key); if (!(value instanceof String text)) return "";
        return text.substring(0, Math.min(max, text.length()));
    }
}
