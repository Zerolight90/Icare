package com.chatbot.parenting.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class KnowledgeService {
    private final JdbcTemplate jdbc;
    private final VectorStore vectors;
    private final ObjectMapper json;
    private final AiRequestGuard guard;
    public record Metadata(String title, String sourceUrl, String publisher, String revisedOn,
            Integer minAgeMonths, Integer maxAgeMonths, String jurisdiction) {
        public Metadata(String title, String sourceUrl, String publisher, String revisedOn) {
            this(title, sourceUrl, publisher, revisedOn, null, null, "UNSPECIFIED");
        }
        public Metadata {
            title = required(title, 200); publisher = required(publisher, 200);
            sourceUrl = required(sourceUrl, 2000);
            try {
                URI uri = URI.create(sourceUrl).normalize();
                if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                    throw new IllegalArgumentException();
                sourceUrl = new URI("https", null, uri.getHost().toLowerCase(Locale.ROOT), uri.getPort(), uri.getPath(), uri.getQuery(), null).toASCIIString();
            } catch (Exception e) { throw new IllegalArgumentException("출처는 유효한 HTTPS 원문 주소여야 합니다."); }
            revisedOn = revisedOn == null ? "" : revisedOn.strip();
            if ((minAgeMonths == null) != (maxAgeMonths == null)
                    || (minAgeMonths != null && (minAgeMonths < 0 || maxAgeMonths < minAgeMonths || maxAgeMonths > 216)))
                throw new IllegalArgumentException("대상 월령은 최소·최대를 함께 0~216개월 범위로 입력하세요.");
            jurisdiction = jurisdiction == null || jurisdiction.isBlank() ? "UNSPECIFIED" : jurisdiction;
            if (!Set.of("KR", "GLOBAL", "US", "UK", "UNSPECIFIED").contains(jurisdiction))
                throw new IllegalArgumentException("자료의 적용 지역을 확인해 주세요.");
            if (!revisedOn.isEmpty()) {
                try { if (LocalDate.parse(revisedOn).isAfter(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")))) throw new IllegalArgumentException(); }
                catch (Exception e) { throw new IllegalArgumentException("개정일은 오늘 이전의 YYYY-MM-DD 또는 미확인으로 입력하세요."); }
            }
        }
        private static String required(String value, int max) {
            if (value == null || value.isBlank() || value.length() > max || value.chars().anyMatch(Character::isISOControl))
                throw new IllegalArgumentException("제목·기관·출처 주소를 길이 제한 내에 입력하세요.");
            return value.strip();
        }
    }
    public record Preview(String hash, String currentVersion, boolean duplicate, boolean active,
            int chunks, int characters, String text, Metadata metadata) { }

    @Transactional(readOnly = true)
    public Preview preview(List<KnowledgeExtractor.Part> parts, Metadata metadata) {
        String hash = fingerprint(parts, metadata);
        var existing = jdbc.queryForList("SELECT id,active FROM knowledge_revision WHERE source_url=? AND content_hash=?", metadata.sourceUrl(), hash);
        var current = jdbc.queryForList("SELECT id FROM knowledge_revision WHERE source_url=? AND active", metadata.sourceUrl());
        String text = parts.stream().map(p -> (p.page() > 0 ? "[PDF " + p.page() + "쪽]\n" : "") + p.text()).collect(java.util.stream.Collectors.joining("\n\n"));
        return new Preview(hash, current.isEmpty() ? "" : current.get(0).get("id").toString(), !existing.isEmpty(),
                !existing.isEmpty() && Boolean.TRUE.equals(existing.get(0).get("active")), chunks(parts, metadata, UUID.randomUUID()).size(),
                parts.stream().mapToInt(p -> p.text().length()).sum(), text, metadata);
    }

    @Transactional
    public Map<String, Object> ingest(List<KnowledgeExtractor.Part> parts, Metadata metadata, String reviewedHash,
            String expectedVersion, boolean replaceApproved) {
        String hash = fingerprint(parts, metadata);
        if (!hash.equals(reviewedHash)) throw new IllegalArgumentException("추출 내용과 출처를 먼저 미리보기에서 검토해 주세요.");
        // Serialize same-source changes across processes; all vector writes share the same JDBC transaction.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtextextended(?,0))", metadata.sourceUrl());
        var duplicate = jdbc.queryForList("SELECT id,active FROM knowledge_revision WHERE source_url=? AND content_hash=?", metadata.sourceUrl(), hash);
        if (!duplicate.isEmpty()) return Map.of("message", Boolean.TRUE.equals(duplicate.get(0).get("active")) ? "이미 등록된 문서입니다." : "이미 보관된 이전 버전입니다. 재활성화하지 않았습니다.", "duplicate", true, "version", duplicate.get(0).get("id").toString());
        var current = jdbc.queryForList("SELECT id FROM knowledge_revision WHERE source_url=? AND active", metadata.sourceUrl());
        String actual = current.isEmpty() ? "" : current.get(0).get("id").toString();
        if (!actual.equals(expectedVersion == null ? "" : expectedVersion) || (!actual.isEmpty() && !replaceApproved))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "현재 버전이 변경되었거나 교체 승인이 필요합니다. 다시 미리보기를 확인해 주세요.");
        UUID version = UUID.randomUUID(); var documents = chunks(parts, metadata, version);
        try (var permit = guard.acquire("admin-knowledge", "reviewed document ingestion")) {
            vectors.add(documents);
            if (!actual.isEmpty()) {
                jdbc.update("UPDATE vector_store SET metadata=jsonb_set(metadata::jsonb,'{icare_active}','false'::jsonb)::json WHERE metadata->>'icare_version'=? AND metadata->>'icare_managed'='true'", actual);
                jdbc.update("UPDATE knowledge_revision SET active=false WHERE id=?::uuid", actual);
            }
            jdbc.update("INSERT INTO knowledge_revision(id,source_url,title,publisher,revised_on,content_hash,active,chunk_count) VALUES (?::uuid,?,?,?,?,? ,true,?)",
                    version.toString(), metadata.sourceUrl(), metadata.title(), metadata.publisher(),
                    metadata.revisedOn().isEmpty() ? null : java.sql.Date.valueOf(metadata.revisedOn()), hash, documents.size());
        }
        return Map.of("message", "검토한 문서를 등록했습니다.", "duplicate", false, "version", version.toString(), "chunks", documents.size());
    }

    public List<Map<String, Object>> versions() {
        return jdbc.queryForList("SELECT id,title,source_url,publisher,revised_on,active,chunk_count,created_at FROM knowledge_revision ORDER BY created_at DESC,id LIMIT 100");
    }

    private String fingerprint(List<KnowledgeExtractor.Part> parts, Metadata metadata) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(List.of("icare-extract-v1", metadata, parts)))); }
        catch (Exception e) { throw new IllegalStateException("문서 검토 해시 생성 실패", e); }
    }
    private List<Document> chunks(List<KnowledgeExtractor.Part> parts, Metadata metadata, UUID version) {
        var result = new ArrayList<Document>();
        for (var part : parts) for (int start = 0; start < part.text().length(); start += 1300) {
            String text = part.text().substring(start, Math.min(part.text().length(), start + 1500));
            var values = new HashMap<String, Object>();
            values.put("icare_managed", true); values.put("icare_active", true); values.put("icare_version", version.toString());
            values.put("source", metadata.title()); values.put("source_url", metadata.sourceUrl());
            values.put("publisher", metadata.publisher()); values.put("revised_on", metadata.revisedOn()); values.put("page", part.page());
            values.put("jurisdiction", metadata.jurisdiction());
            if (metadata.minAgeMonths() != null) {
                values.put("min_age_months", metadata.minAgeMonths()); values.put("max_age_months", metadata.maxAgeMonths());
            }
            result.add(new Document(UUID.randomUUID().toString(), text, values));
            if (result.size() > 32) throw new IllegalArgumentException("문서가 32개 검색 조각을 넘습니다. 주제별로 나눠 주세요.");
            if (start + 1500 >= part.text().length()) break;
        }
        if (result.isEmpty() || parts.stream().mapToInt(p -> p.text().length()).sum() > KnowledgeExtractor.MAX_CHARS)
            throw new IllegalArgumentException("문서 길이가 유효하지 않습니다.");
        return result;
    }
}
