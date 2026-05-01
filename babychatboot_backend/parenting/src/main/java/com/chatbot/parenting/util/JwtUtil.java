package com.chatbot.parenting.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtil {

    private final SecretKey key;
    private final long accessTokenExpiration = 24 * 60 * 60 * 1000L;

    // 생성자에서 secret 값을 읽어와 Key로 변환합니다.
    public JwtUtil(@Value("${jwt.secret}") String secretString) {
        // 읽어온 문자열을 HMAC-SHA 알고리즘용 키로 변환
        this.key = Keys.hmacShaKeyFor(secretString.getBytes(StandardCharsets.UTF_8));
    }

    public String createToken(String email, String role) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + accessTokenExpiration);

        return Jwts.builder()
                .subject(email)
                .claim("role", role)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(key)
                .compact();
    }

    // 4. 토큰에서 이메일 꺼내기
    public String getEmailFromToken(String token) {
        Claims claims = Jwts.parser() // .parserBuilder() -> .parser() 로 변경됨
                .verifyWith(key)      // .setSigningKey -> .verifyWith 로 변경됨
                .build()
                .parseSignedClaims(token) // .parseClaimsJws -> .parseSignedClaims 로 변경됨
                .getPayload();        // .getBody -> .getPayload 로 변경됨

        return claims.getSubject();
    }

    // 5. 토큰 유효성 검사
    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}