package com.chatbot.parenting.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

// 🟢 [추가된 부분] CORS와 List를 사용하기 위한 import 문장들
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); 
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) 
            .cors(cors -> cors.configure(http))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/users/login", "/api/users/signup", "/api/users/verify", "/api/users/send-email").permitAll()
            .requestMatchers("/api/categories/**").permitAll()
            .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/community/**").permitAll()
            .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/hospitals/**").permitAll()
            .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/upload/**").permitAll()
            .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/logs/**/export").authenticated()
            .requestMatchers("/api/users/me").authenticated()
            .requestMatchers("/api/chat/**").authenticated()
            .requestMatchers("/api/babies/**").authenticated()
            .requestMatchers("/api/upload").authenticated()
            .anyRequest().authenticated()
             )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // 🟢 [추가된 부분] CORS VIP 명단
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        configuration.setAllowedOrigins(List.of("http://localhost:3000", "http://roni.myds.me:3000"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}