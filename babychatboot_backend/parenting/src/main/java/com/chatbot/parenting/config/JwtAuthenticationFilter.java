package com.chatbot.parenting.config;

import com.chatbot.parenting.util.JwtUtil;
import com.chatbot.parenting.repository.AdminRepository;
import com.chatbot.parenting.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final PrivateAccessPolicy privateAccess;
    private final UserRepository users;
    private final AdminRepository admins;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                var claims = jwtUtil.getClaims(header.substring(7));
                String subject = claims.getSubject();
                privateAccess.requireAllowed(subject);
                String kind = claims.get("kind", String.class);
                if ("USER".equals(kind)) {
                    users.findByEmail(subject).filter(u -> u.isEmailVerified()).ifPresent(u -> authenticate(u.getEmail(), "USER"));
                } else if ("ADMIN".equals(kind)) {
                    admins.findByUsername(subject).filter(a -> a.isActive()).ifPresent(a -> authenticate(a.getUsername(), "ADMIN"));
                }
                // Tokens issued before account-kind separation intentionally require a new login.
            } catch (Exception e) {
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(request, response);
    }

    private void authenticate(String subject, String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                subject, null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}