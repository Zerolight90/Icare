package com.chatbot.parenting;

import com.chatbot.parenting.config.*;
import com.chatbot.parenting.domain.Admin;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.repository.*;
import com.chatbot.parenting.util.JwtUtil;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PrivateSecurityTest {
    static final String EMAIL = "parent@example.test";
    static final String PROXY = "test-proxy-secret-with-at-least-32-characters";
    AnnotationConfigWebApplicationContext context;
    MockMvc mvc;
    JwtUtil jwt;
    UserRepository users;
    AdminRepository admins;

    @BeforeEach void setup() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        org.springframework.test.context.support.TestPropertySourceUtils.addInlinedPropertiesToEnvironment(context,
                "icare.security.cors-allowed-origins=https://frontend.example.test");
        context.register(TestConfig.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(context.getBean("springSecurityFilterChain", jakarta.servlet.Filter.class)).build();
        jwt = context.getBean(JwtUtil.class); users = context.getBean(UserRepository.class); admins = context.getBean(AdminRepository.class);
        User user = mock(User.class);
        when(user.getEmail()).thenReturn(EMAIL); when(user.isEmailVerified()).thenReturn(true);
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
    }
    @AfterEach void close() { context.close(); org.springframework.security.core.context.SecurityContextHolder.clearContext(); }

    @Test void bothServiceAndUserAuthenticationAreRequired() throws Exception {
        String token = jwt.createUserToken(EMAIL, "MOM");
        mvc.perform(get("/api/probe").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/probe").header("CF-Access-Client-Secret", PROXY).header("X-Icare-Proxy-Secret", "forged")).andExpect(status().isForbidden());
        mvc.perform(get("/api/probe").header("X-Icare-Proxy-Secret", PROXY)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/probe").header("X-Icare-Proxy-Secret", PROXY).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
    }
    @Test void userRoleClaimCannotBecomeAdministrator() throws Exception {
        String token = jwt.createUserToken(EMAIL, "ADMIN");
        mvc.perform(get("/api/admin/probe").header("X-Icare-Proxy-Secret", PROXY).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        verifyNoInteractions(admins);
    }
    @Test void activeAdminIsRecheckedAndCannotImpersonateUserWithSameEmail() throws Exception {
        Admin admin = new Admin(EMAIL, "test-hash", "test");
        when(admins.findByUsername(EMAIL)).thenReturn(Optional.of(admin));
        String token = jwt.createAdminToken(EMAIL);
        mvc.perform(get("/api/admin/probe").header("X-Icare-Proxy-Secret", PROXY).header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(get("/api/probe").header("X-Icare-Proxy-Secret", PROXY).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        admin.setActive(false);
        mvc.perform(get("/api/admin/probe").header("X-Icare-Proxy-Secret", PROXY).header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
    @Test void anyRegisteredVerifiedUserCanAuthenticate() throws Exception {
        User user = mock(User.class);
        when(user.getEmail()).thenReturn("newparent@example.test");
        when(user.isEmailVerified()).thenReturn(true);
        when(users.findByEmail("newparent@example.test")).thenReturn(Optional.of(user));
        mvc.perform(get("/api/probe").header("X-Icare-Proxy-Secret", PROXY)
            .header("Authorization", "Bearer " + jwt.createUserToken("newparent@example.test", "MOM"))).andExpect(status().isOk());
        when(user.isEmailVerified()).thenReturn(false);
        mvc.perform(get("/api/probe").header("X-Icare-Proxy-Secret", PROXY)
            .header("Authorization", "Bearer " + jwt.createUserToken("newparent@example.test", "MOM"))).andExpect(status().isUnauthorized());
    }
    @Test void removedOrUnknownUsersLoseTokenAccess() throws Exception {
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());
        for (String email : new String[]{EMAIL, "outsider@example.test"})
            mvc.perform(get("/api/probe").header("X-Icare-Proxy-Secret", PROXY)
                .header("Authorization", "Bearer " + jwt.createUserToken(email, "DAD"))).andExpect(status().isUnauthorized());
    }
    @Test void authEndpointsHaveGlobalRateLimitAndHealthHasNoData() throws Exception {
        mvc.perform(get("/healthz")).andExpect(status().isOk());
        for (int i = 0; i < 20; i++) mvc.perform(post("/api/users/login").header("X-Icare-Proxy-Secret", PROXY)).andExpect(status().isOk());
        mvc.perform(post("/api/users/login").header("X-Icare-Proxy-Secret", PROXY)).andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "60"));
    }

    @Test void corsAllowsOnlyConfiguredOriginAndDoesNotBypassServiceAuthentication() throws Exception {
        mvc.perform(options("/api/probe").header("Origin", "https://frontend.example.test")
                .header("Access-Control-Request-Method", "GET").header("Access-Control-Request-Headers", "Authorization"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "https://frontend.example.test"));
        mvc.perform(options("/api/probe").header("Origin", "https://evil.test")
                .header("Access-Control-Request-Method", "GET")).andExpect(status().isForbidden());
        mvc.perform(options("/api/probe").header("Origin", "https://frontend.example.test")
                .header("Access-Control-Request-Method", "GET").header("Access-Control-Request-Headers", "X-Icare-Proxy-Secret"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/probe").header("Origin", "https://frontend.example.test")
                .header("Authorization", "Bearer " + jwt.createUserToken(EMAIL, "MOM"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/probe").header("Origin", "https://frontend.example.test")
                .header("X-Icare-Proxy-Secret", PROXY).header("Authorization", "Bearer " + jwt.createUserToken(EMAIL, "MOM")))
                .andExpect(status().isOk());
    }

    @Test void corsRejectsWildcardsAndEmptyConfigurationFailsClosed() throws Exception {
        var factory = new PrivateCorsConfiguration();
        for (String invalid : new String[]{"*", "https://*.example.test", "https://example.test/path", "https://u:p@example.test", "null", "https://example.test,"})
            org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class, () -> factory.corsSource(invalid));
        var req = new org.springframework.mock.web.MockHttpServletRequest("GET", "/api/probe");
        var config = factory.corsSource("").getCorsConfiguration(req);
        org.junit.jupiter.api.Assertions.assertNull(config.checkOrigin("https://frontend.example.test"));
    }

    @Configuration @EnableWebMvc @Import({SecurityConfig.class, PrivateCorsConfiguration.class})
    static class TestConfig {
        @Bean JwtUtil jwtUtil() { return new JwtUtil("test-only-signing-key-32-characters-minimum"); }
        @Bean AccountPolicy policy() { return new AccountPolicy(); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean AdminRepository admins() { return mock(AdminRepository.class); }
        @Bean JwtAuthenticationFilter jwtFilter(JwtUtil jwt, AccountPolicy policy, UserRepository users, AdminRepository admins) {
            return new JwtAuthenticationFilter(jwt, policy, users, admins);
        }
        @Bean ProxyAuthenticationFilter proxy() { return new ProxyAuthenticationFilter(PROXY); }
        @Bean Probe probe() { return new Probe(); }
    }
    @RestController static class Probe {
        @GetMapping({"/api/probe", "/api/admin/probe", "/healthz"}) String get() { return "ok"; }
        @PostMapping("/api/users/login") String login() { return "ok"; }
    }
}
