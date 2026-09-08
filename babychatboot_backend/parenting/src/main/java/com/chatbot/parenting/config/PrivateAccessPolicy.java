package com.chatbot.parenting.config;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class PrivateAccessPolicy {
    private final Set<String> allowedEmails;

    public PrivateAccessPolicy(@Value("${icare.security.allowed-emails:}") String emails) {
        allowedEmails = Arrays.stream(emails.split(","))
                .map(PrivateAccessPolicy::normalize).filter(s -> !s.isEmpty()).collect(Collectors.toUnmodifiableSet());
        if (allowedEmails.size() > 2 || allowedEmails.stream().anyMatch(s -> !s.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+"))) {
            throw new IllegalArgumentException("Configure one or two valid allowed email addresses");
        }
    }

    public static String normalize(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }

    public boolean allows(String email) { return allowedEmails.contains(normalize(email)); }

    public String requireAllowed(String email) {
        if (!allows(email)) throw new AccessDeniedException("비공개 테스트에 허용된 계정만 사용할 수 있습니다.");
        return normalize(email);
    }

    public static void requirePassword(String password) {
        if (password == null || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("비밀번호는 12자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
        }
    }
}
