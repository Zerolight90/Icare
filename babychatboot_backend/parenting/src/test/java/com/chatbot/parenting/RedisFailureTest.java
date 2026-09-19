package com.chatbot.parenting;
import com.chatbot.parenting.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.domain.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RedisFailureTest {
    @Test void unavailableRedisDoesNotBypassAiLimitsButBoardReadsUseDatabase() {
        var redis = mock(StringRedisTemplate.class, invocation -> {throw new RedisConnectionFailureException("synthetic outage");});
        var control = new RedisRequestControl(redis,"test:");
        assertThatThrownBy(() -> control.acquire("parent",5)).hasMessageContaining("503");
        assertThatThrownBy(() -> control.allowAuthAttempt()).hasMessageContaining("503");
        var cache = new CommunityCache(redis,new ObjectMapper(),"test:");
        assertThat(cache.posts(1,PageRequest.of(0,10),Page::empty)).isEmpty();
        assertThatCode(cache::invalidateAfterCommit).doesNotThrowAnyException();
    }
}
