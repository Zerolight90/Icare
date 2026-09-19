package com.chatbot.parenting.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class RedisRequestControl implements RequestControl {
    private final StringRedisTemplate redis;
    private final String prefix;
    // A request that takes longer than the lease must fail before returning/committing.
    // Token comparison prevents an expired owner from releasing a newer request's lease.
    private static final DefaultRedisScript<Long> ACQUIRE = new DefaultRedisScript<>("""
        if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
        local count = tonumber(redis.call('GET', KEYS[2]) or '0')
        if count >= tonumber(ARGV[2]) then return 0 end
        redis.call('SET', KEYS[1], ARGV[1], 'PX', 120000)
        if redis.call('INCR', KEYS[2]) == 1 then redis.call('PEXPIRE', KEYS[2], 60000) end
        return 1
        """, Long.class);
    private static final DefaultRedisScript<Long> RELEASE = new DefaultRedisScript<>("""
        if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
        return 0
        """, Long.class);
    private static final DefaultRedisScript<Long> RATE = new DefaultRedisScript<>("""
        local count = redis.call('INCR', KEYS[1])
        if count == 1 then redis.call('PEXPIRE', KEYS[1], 60000) end
        return count
        """, Long.class);

    public RedisRequestControl(StringRedisTemplate redis, @Value("${icare.redis.prefix:icare:v1:}") String prefix) {
        if (!prefix.matches("[a-zA-Z0-9:_-]{1,80}")) throw new IllegalArgumentException("Invalid Redis namespace");
        this.redis = redis; this.prefix = prefix;
    }
    private String key(String subject) {
        try { return prefix + "ai:" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(subject.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    @Override public String acquire(String subject, int limit) {
        String key = key(subject), token = UUID.randomUUID().toString();
        Long result;
        try { result = redis.execute(ACQUIRE, List.of(key + ":busy", key + ":rate"), token, Integer.toString(limit)); }
        catch (org.springframework.dao.DataAccessException e) { throw unavailable(); }
        if (!Long.valueOf(1).equals(result)) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "잠시 후 다시 요청해 주세요.");
        return token;
    }
    @Override public void check(String subject, String token) {
        String actual;
        try { actual = redis.opsForValue().get(key(subject) + ":busy"); }
        catch (org.springframework.dao.DataAccessException e) { throw unavailable(); }
        if (!token.equals(actual)) throw unavailable();
    }
    @Override public void release(String subject, String token) {
        try { redis.execute(RELEASE, List.of(key(subject) + ":busy"), token); }
        catch (org.springframework.dao.DataAccessException e) { /* TTL recovers a failed release; do not mask the request error. */ }
    }
    @Override public boolean allowAuthAttempt() {
        try { Long count = redis.execute(RATE, List.of(prefix + "auth:rate")); return count != null && count <= 20; }
        catch (org.springframework.dao.DataAccessException e) { throw unavailable(); }
    }
    private ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "요청 제어 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }
}
