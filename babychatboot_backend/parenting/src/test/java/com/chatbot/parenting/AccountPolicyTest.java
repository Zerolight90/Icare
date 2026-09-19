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

class AccountPolicyTest {
    @Test void acceptsAnyValidEmailAndRejectsMalformedAddresses() {
        var policy = new AccountPolicy();
        assertThat(policy.requireEmail(" NewParent@EXAMPLE.test ")).isEqualTo("newparent@example.test");
        assertThat(policy.requireEmail("third@example.test")).isEqualTo("third@example.test");
        for (String invalid : new String[]{"", "invalid", "a b@example.test", "a@b", "x".repeat(250)+"@a.test"})
            assertThatThrownBy(() -> policy.requireEmail(invalid)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void signupRejectsPrivilegeInjectionBeforeAnyWrites() {
        var users = mock(UserRepository.class); var families = mock(FamilyRepository.class); var babies = mock(BabyRepository.class);
        var service = new UserService(users, families, babies, new BCryptPasswordEncoder(), mock(JwtUtil.class), mock(CommunityCache.class), new AccountPolicy());
        var dto = new SignupRequestDto(); dto.setEmail("newparent@example.test"); dto.setRole("ADMIN");
        assertThatThrownBy(() -> service.signup(dto)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(users, families, babies);
    }
    @Test void newParentCanSignupButCannotLoginBeforeEmailVerification() {
        var users = mock(UserRepository.class); var families = mock(FamilyRepository.class); var babies = mock(BabyRepository.class);
        var encoder = new BCryptPasswordEncoder();
        var service = new UserService(users, families, babies, encoder, mock(JwtUtil.class), mock(CommunityCache.class), new AccountPolicy());
        var dto = new SignupRequestDto(); dto.setEmail("newparent@example.test"); dto.setRole("MOM");
        dto.setPassword("test-only-long-password"); dto.setInviteCode("SAMPLE");
        when(families.findByInviteCode("SAMPLE")).thenReturn(java.util.Optional.of(new com.chatbot.parenting.domain.Family("SAMPLE")));
        service.signup(dto);
        var saved = org.mockito.ArgumentCaptor.forClass(com.chatbot.parenting.domain.User.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().isEmailVerified()).isFalse();
        when(users.findByEmailIgnoreCase(dto.getEmail())).thenReturn(java.util.Optional.of(saved.getValue()));
        var login = mock(LoginRequestDto.class); when(login.getEmail()).thenReturn(dto.getEmail()); when(login.getPassword()).thenReturn(dto.getPassword());
        assertThatThrownBy(() -> service.login(login)).hasMessageContaining("인증");
    }
    @Test void bootstrapRequiresExplicitSafeCredentialsAndPreservesExistingAdmin() {
        var admins = mock(AdminRepository.class); var encoder = new BCryptPasswordEncoder(); var policy = new AccountPolicy();
        assertThatThrownBy(() -> new AdminBootstrap(admins, encoder, policy, "a@example.test", "short")).isInstanceOf(IllegalArgumentException.class);
        var bootstrap = new AdminBootstrap(admins, encoder, policy, "a@example.test", "test-only-long-password");
        when(admins.count()).thenReturn(1L);
        assertThatThrownBy(() -> bootstrap.run(null)).isInstanceOf(IllegalStateException.class);
        verify(admins, never()).save(any());
    }
    @Test void aiLimitsRejectOversizeConcurrentAndExcessRequests() {
        var guard = new AiRequestGuard(20, 32, 2, new FakeRequestControl());
        assertThatThrownBy(() -> guard.acquire("a", "x".repeat(21))).hasMessageContaining("400");
        try (var permit = guard.acquire("a", "question")) {
            assertThatThrownBy(() -> guard.acquire("a", "question")).hasMessageContaining("429");
        }
        try (var permit = guard.acquire("a", "retry")) { }
        assertThatThrownBy(() -> guard.acquire("a", "question")).hasMessageContaining("429");
        try (var permit = guard.acquire("b", "question")) { }
    }
}
