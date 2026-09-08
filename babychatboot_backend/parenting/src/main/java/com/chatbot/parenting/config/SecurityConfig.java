package com.chatbot.parenting.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtFilter;
    private final ProxyAuthenticationFilter proxyFilter;

    @Bean
    public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable()) // Only server proxy + explicit bearer authentication; no backend cookies.
            .cors(cors -> cors.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/healthz").permitAll()
                .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/users/login", "/api/users/signup",
                    "/api/users/verify", "/api/users/send-email", "/api/admin/auth/login").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/upload/**").hasAnyRole("USER", "ADMIN")
                .requestMatchers("/api/**").hasRole("USER")
                .anyRequest().denyAll())
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(proxyFilter, JwtAuthenticationFilter.class)
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> res.setStatus(401))
                .accessDeniedHandler((req, res, ex) -> res.setStatus(403)));
        return http.build();
    }

    // Components must run inside the security chain, never as duplicate servlet filters.
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtRegistration() {
        var bean = new FilterRegistrationBean<>(jwtFilter); bean.setEnabled(false); return bean;
    }
    @Bean
    public FilterRegistrationBean<ProxyAuthenticationFilter> proxyRegistration() {
        var bean = new FilterRegistrationBean<>(proxyFilter); bean.setEnabled(false); return bean;
    }
}