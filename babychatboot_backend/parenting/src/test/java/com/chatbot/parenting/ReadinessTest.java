package com.chatbot.parenting;
import com.chatbot.parenting.controller.HealthController;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisConnection;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class ReadinessTest {
    @Test void readinessRequiresDatabaseAndRedisButLivenessDoesNot() {
        var db=mock(JdbcTemplate.class); var redis=mock(StringRedisTemplate.class);
        var factory=mock(RedisConnectionFactory.class); var connection=mock(RedisConnection.class);
        when(redis.getConnectionFactory()).thenReturn(factory); when(factory.getConnection()).thenReturn(connection);
        when(connection.ping()).thenReturn("PONG");
        var health=new HealthController(db,redis);
        assertThat(health.ready().getStatusCode().value()).isEqualTo(200);
        when(connection.ping()).thenThrow(new RuntimeException("synthetic outage"));
        assertThat(health.ready().getStatusCode().value()).isEqualTo(503);
        assertThat(health.health().get("status")).isEqualTo("up");
        when(db.queryForObject("SELECT 1",Integer.class)).thenThrow(new RuntimeException("db down"));
        assertThat(health.ready().getStatusCode().value()).isEqualTo(503);
    }
}
