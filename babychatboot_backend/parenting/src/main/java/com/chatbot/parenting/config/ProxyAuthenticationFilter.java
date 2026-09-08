package com.chatbot.parenting.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Independent of end-user JWTs. Never enable a browser-facing bypass. */
@Component
public class ProxyAuthenticationFilter extends OncePerRequestFilter {
    private final byte[] expected;
    private final boolean configured;
    private long windowStart = System.nanoTime();
    private int attempts;
    private static final Set<String> AUTH_PATHS = Set.of("/api/users/login", "/api/users/signup",
            "/api/users/send-email", "/api/users/verify", "/api/admin/auth/login");

    public ProxyAuthenticationFilter(@Value("${icare.security.proxy-secret:}") String secret) {
        configured = secret.length() >= 32;
        expected = secret.getBytes(StandardCharsets.UTF_8);
        if (!secret.isEmpty() && !configured) throw new IllegalArgumentException("Proxy secret must have at least 32 characters");
    }

    private synchronized boolean allowAuthAttempt() {
        long now = System.nanoTime();
        if (now - windowStart >= 60_000_000_000L) { windowStart = now; attempts = 0; }
        return ++attempts <= 20;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        if (req.getRequestURI().equals("/healthz") && req.getMethod().equals("GET")) {
            chain.doFilter(req, res);
            return;
        }
        String supplied = req.getHeader("X-Icare-Proxy-Secret");
        if (!configured || supplied == null || !MessageDigest.isEqual(expected, supplied.getBytes(StandardCharsets.UTF_8))) {
            res.setStatus(403);
            return;
        }
        if (AUTH_PATHS.contains(req.getRequestURI()) && !allowAuthAttempt()) {
            res.setHeader("Retry-After", "60");
            res.setStatus(429);
            return;
        }
        chain.doFilter(req, res);
    }
}
