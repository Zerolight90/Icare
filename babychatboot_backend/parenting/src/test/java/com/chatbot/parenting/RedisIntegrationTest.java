package com.chatbot.parenting;

import com.chatbot.parenting.service.*;
import com.chatbot.parenting.dto.PostListResponseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.domain.*;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="ICARE_TEST_REDIS", matches="true")
class RedisIntegrationTest {
    LettuceConnectionFactory factory;
    StringRedisTemplate redis;
    String prefix;
    @BeforeEach void setup() {
        // Only loopback, database 15 and a unique synthetic namespace; never FLUSHDB.
        var config = new RedisStandaloneConfiguration("127.0.0.1", Integer.parseInt(System.getenv().getOrDefault("ICARE_TEST_REDIS_PORT", "6379")));
        config.setDatabase(15); config.setPassword(System.getenv("ICARE_TEST_REDIS_PASSWORD"));
        factory = new LettuceConnectionFactory(config); factory.afterPropertiesSet(); factory.start();
        redis = new StringRedisTemplate(factory); prefix = "test:" + UUID.randomUUID() + ":";
    }
    @AfterEach void close() {
        try (var cursor = redis.scan(org.springframework.data.redis.core.ScanOptions.scanOptions().match(prefix + "*").count(100).build())) {
            var keys = new ArrayList<String>(); cursor.forEachRemaining(keys::add); if (!keys.isEmpty()) redis.delete(keys);
        } finally { factory.destroy(); }
    }
    @Test void independentServersShareRateAndOwnershipAndExpiredOwnerCannotReleaseReplacement() {
        var first = new RedisRequestControl(redis, prefix); var second = new RedisRequestControl(redis, prefix);
        String token = first.acquire("synthetic-parent", 2);
        assertThatThrownBy(() -> second.acquire("synthetic-parent", 2)).hasMessageContaining("429");
        second.release("synthetic-parent", "wrong-owner");
        first.check("synthetic-parent", token);
        first.release("synthetic-parent", token);
        String replacement = second.acquire("synthetic-parent", 2);
        first.release("synthetic-parent", token);
        second.check("synthetic-parent", replacement);
        assertThatThrownBy(() -> first.check("synthetic-parent", token)).hasMessageContaining("503");
        second.release("synthetic-parent", replacement);
        assertThatThrownBy(() -> first.acquire("synthetic-parent", 2)).hasMessageContaining("429");
        for (int i=0; i<20; i++) assertThat((i%2==0 ? first : second).allowAuthAttempt()).isTrue();
        assertThat(first.allowAuthAttempt()).isFalse();
        try (var cursor=redis.scan(org.springframework.data.redis.core.ScanOptions.scanOptions().match(prefix+"*rate").build())) {
            cursor.forEachRemaining(key -> assertThat(redis.getExpire(key)).isBetween(1L,60L));
        }
    }
    @Test void leaseRemainsHeldUntilCommitAndLossPreventsCommit() {
        var control = new RedisRequestControl(redis, prefix); var guard = new AiRequestGuard(4000,1024,5,control);
        TransactionSynchronizationManager.initSynchronization();
        try {
            guard.acquire("parent", "question").close();
            assertThatThrownBy(() -> control.acquire("parent",5)).hasMessageContaining("429");
            var callbacks = TransactionSynchronizationManager.getSynchronizations();
            callbacks.forEach(c -> c.beforeCommit(false));
            try(var cursor=redis.scan(org.springframework.data.redis.core.ScanOptions.scanOptions().match(prefix+"*busy").build())) {
                cursor.forEachRemaining(redis::delete);
            }
            assertThatThrownBy(() -> callbacks.forEach(c -> c.beforeCommit(false))).hasMessageContaining("503");
            callbacks.forEach(c -> c.afterCompletion(1));
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }
    @Test void concurrentAdmissionAllowsOnlyOneOwnerAcrossServers() throws Exception {
        var workers = java.util.concurrent.Executors.newFixedThreadPool(8);
        var start = new java.util.concurrent.CountDownLatch(1);
        var tokens = new java.util.concurrent.ConcurrentLinkedQueue<String>();
        var jobs = new ArrayList<java.util.concurrent.Future<?>>();
        try {
            for (int i=0;i<8;i++) jobs.add(workers.submit(() -> {
                try {
                    start.await();
                    tokens.add(new RedisRequestControl(redis,prefix).acquire("same-parent",5));
                } catch (org.springframework.web.server.ResponseStatusException e) {
                    assertThat(e.getStatusCode().value()).isEqualTo(429);
                } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
            }));
            start.countDown(); for (var job:jobs) job.get(10,java.util.concurrent.TimeUnit.SECONDS);
            assertThat(tokens).hasSize(1);
        } finally {workers.shutdownNow();}
    }
    @Test void cacheHitsInvalidatesOnlyOnCommitAndCannotRepopulateOldRevision() {
        var cache = new CommunityCache(redis,new ObjectMapper(),prefix);
        var page=PageRequest.of(0,10); var queries=new AtomicInteger();
        java.util.function.Supplier<Page<PostListResponseDto>> query=() -> {
            int n=queries.incrementAndGet();
            return new PageImpl<>(List.of(new PostListResponseDto(1L,"revision"+n,"parent",0,0,"2026-09-19","test",1L)),page,1);
        };
        assertThat(cache.posts(1,page,query).getContent().get(0).getTitle()).isEqualTo("revision1");
        cache.posts(1,page,query); assertThat(queries).hasValue(1);
        TransactionSynchronizationManager.initSynchronization();
        try {
            cache.invalidateAfterCommit(); cache.posts(1,page,query); assertThat(queries).hasValue(1);
            TransactionSynchronizationManager.getSynchronizations().forEach(c -> c.afterCommit());
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
        cache.posts(1,page,query); assertThat(queries).hasValue(2);
        cache.invalidateAfterCommit();
        cache.posts(1,page,() -> {cache.invalidateAfterCommit();return query.get();});
        cache.posts(1,page,query); assertThat(queries).hasValue(4);
    }
}
