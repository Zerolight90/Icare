package com.chatbot.parenting.config;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.springframework.stereotype.Component;

@Component
public class AccountPolicy {
    public static String normalize(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }

    public String requireEmail(String email) {
        String normalized = normalize(email);
        if (normalized.length() > 254 || !normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            throw new IllegalArgumentException("올바른 이메일 주소를 입력해 주세요.");
        }
        return normalized;
    }

    public static void requirePassword(String password) {
        if (password == null || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("비밀번호는 12자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
        }
    }
}
