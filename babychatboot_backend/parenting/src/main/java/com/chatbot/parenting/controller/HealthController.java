package com.chatbot.parenting.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@lombok.RequiredArgsConstructor
public class HealthController {
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final org.springframework.data.redis.core.StringRedisTemplate redis;
    @GetMapping("/healthz")
    public Map<String, String> health() { return Map.of("status", "up"); }
    @GetMapping("/readyz")
    public org.springframework.http.ResponseEntity<?> ready() {
        try {
            jdbc.queryForObject("SELECT 1", Integer.class);
            try (var connection = redis.getConnectionFactory().getConnection()) {
                if (!"PONG".equals(connection.ping())) throw new IllegalStateException();
            }
            return org.springframework.http.ResponseEntity.ok(Map.of("status", "ready"));
        } catch (Exception e) {
            return org.springframework.http.ResponseEntity.status(503).body(Map.of("status", "unavailable"));
        }
    }
}
