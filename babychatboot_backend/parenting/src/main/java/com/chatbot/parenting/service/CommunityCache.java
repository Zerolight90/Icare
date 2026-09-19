package com.chatbot.parenting.service;

import com.chatbot.parenting.dto.PostListResponseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** No private chat/profile data, entity serialization, or unbounded key scans. */
@Component
public class CommunityCache {
    private final StringRedisTemplate redis;
    private final ObjectMapper json;
    private final String prefix;
    public record Snapshot(List<PostListResponseDto> content, long total) { }
    public CommunityCache(StringRedisTemplate redis, ObjectMapper json, @Value("${icare.redis.prefix:icare:v1:}") String prefix) {
        this.redis = redis; this.json = json; this.prefix = prefix + "community:";
    }
    public Page<PostListResponseDto> posts(long boardId, Pageable page, Supplier<Page<PostListResponseDto>> query) {
        String key = null;
        try {
            String revision = redis.opsForValue().get(prefix + "revision");
            if (revision == null) {
                redis.opsForValue().setIfAbsent(prefix + "revision", UUID.randomUUID().toString());
                revision = redis.opsForValue().get(prefix + "revision");
            }
            if (revision != null) {
                key = prefix + revision + ":" + boardId + ":" + page.getPageNumber() + ":" + page.getPageSize();
                String cached = redis.opsForValue().get(key);
                if (cached != null) {
                    var snapshot = json.readValue(cached, Snapshot.class);
                    return new PageImpl<>(snapshot.content(), page, snapshot.total());
                }
            }
        } catch (org.springframework.dao.DataAccessException | com.fasterxml.jackson.core.JsonProcessingException e) { key = null; }
        Page<PostListResponseDto> result = query.get();
        if (key != null) {
            try { redis.opsForValue().set(key, json.writeValueAsString(new Snapshot(result.getContent(), result.getTotalElements())), Duration.ofSeconds(30)); }
            catch (org.springframework.dao.DataAccessException | com.fasterxml.jackson.core.JsonProcessingException e) { /* DB is authoritative. */ }
        }
        return result;
    }
    public void invalidateAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { invalidate(); }
            });
        } else invalidate();
    }
    private void invalidate() {
        try { redis.opsForValue().set(prefix + "revision", UUID.randomUUID().toString()); }
        catch (org.springframework.dao.DataAccessException e) { /* Existing snapshots expire within 30s even if invalidation fails. */ }
    }
}
