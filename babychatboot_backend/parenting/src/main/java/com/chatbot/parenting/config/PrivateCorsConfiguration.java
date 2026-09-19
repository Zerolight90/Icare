package com.chatbot.parenting.config;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class PrivateCorsConfiguration {
    @Bean
    public UrlBasedCorsConfigurationSource corsSource(
            @Value("${icare.security.cors-allowed-origins:}") String configuredOrigins) {
        var origins = new ArrayList<String>();
        if (!configuredOrigins.isBlank()) for (String entry : configuredOrigins.split(",", -1)) {
            String origin = entry.strip();
            try {
                URI uri = URI.create(origin);
                boolean local = List.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost());
                if (uri.getHost() == null || uri.getUserInfo() != null || uri.getRawQuery() != null ||
                        uri.getRawFragment() != null || !uri.getRawPath().isEmpty() ||
                        !("https".equals(uri.getScheme()) || (local && "http".equals(uri.getScheme()))))
                    throw new IllegalArgumentException();
                origins.add(origin);
            } catch (RuntimeException ex) {
                throw new IllegalArgumentException("CORS origins must be exact HTTPS origins (HTTP loopback allowed), without paths or wildcards");
            }
        }
        var config = new CorsConfiguration();
        config.setAllowedOrigins(origins);
        config.setAllowedMethods(List.of("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        // Browser clients still use Next /api. Never allow a browser to send the service secret.
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setAllowCredentials(false);
        config.setMaxAge(600L);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
