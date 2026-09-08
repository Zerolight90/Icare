package com.chatbot.parenting;

import com.chatbot.parenting.config.*;
import com.chatbot.parenting.dto.*;
import com.chatbot.parenting.repository.*;
import com.chatbot.parenting.service.*;
import com.chatbot.parenting.util.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PrivateAccessPolicyTest {
    @Test void oneOrTwoAddressesAndEmptyFailsClosed() {
        assertThat(new PrivateAccessPolicy(" A@example.test, B@example.test ").allows("a@EXAMPLE.test")).isTrue();
        assertThat(new PrivateAccessPolicy("").allows("a@example.test")).isFalse();
        assertThatThrownBy(() -> new PrivateAccessPolicy("a@a.test,b@a.test,c@a.test")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PrivateAccessPolicy("invalid")).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void signupRejectsPrivilegeInjectionAndOutsiderBeforeAnyWrites() {
        var users = mock(UserRepository.class); var families = mock(FamilyRepository.class); var babies = mock(BabyRepository.class);
        var service = new UserService(users, families, babies, new BCryptPasswordEncoder(), mock(JwtUtil.class), new PrivateAccessPolicy("a@example.test"));
        var dto = new SignupRequestDto(); dto.setEmail("a@example.test"); dto.setRole("ADMIN");
        assertThatThrownBy(() -> service.signup(dto)).isInstanceOf(IllegalArgumentException.class);
        dto.setEmail("outsider@example.test"); dto.setRole("MOM");
        assertThatThrownBy(() -> service.signup(dto)).isInstanceOf(AccessDeniedException.class);
        var login = mock(LoginRequestDto.class); when(login.getEmail()).thenReturn("outsider@example.test");
        assertThatThrownBy(() -> service.login(login)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.verifyEmail("outsider@example.test", "123456")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(users, families, babies);
    }
    @Test void bootstrapRequiresExplicitSafeCredentialsAndPreservesExistingAdmin() {
        var admins = mock(AdminRepository.class); var encoder = new BCryptPasswordEncoder(); var policy = new PrivateAccessPolicy("a@example.test");
        assertThatThrownBy(() -> new AdminBootstrap(admins, encoder, policy, "a@example.test", "short")).isInstanceOf(IllegalArgumentException.class);
        var bootstrap = new AdminBootstrap(admins, encoder, policy, "a@example.test", "test-only-long-password");
        when(admins.count()).thenReturn(1L);
        assertThatThrownBy(() -> bootstrap.run(null)).isInstanceOf(IllegalStateException.class);
        verify(admins, never()).save(any());
    }
    @Test void aiLimitsRejectOversizeConcurrentAndExcessRequests() {
        var guard = new AiRequestGuard(20, 32, 2);
        assertThatThrownBy(() -> guard.acquire("a", "x".repeat(21))).hasMessageContaining("400");
        try (var permit = guard.acquire("a", "question")) {
            assertThatThrownBy(() -> guard.acquire("a", "question")).hasMessageContaining("429");
        }
        try (var permit = guard.acquire("a", "retry")) { }
        assertThatThrownBy(() -> guard.acquire("a", "question")).hasMessageContaining("429");
        try (var permit = guard.acquire("b", "question")) { }
    }
}
