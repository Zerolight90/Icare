package com.chatbot.parenting.controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<?> limited(org.springframework.web.server.ResponseStatusException e) {
        var builder = ResponseEntity.status(e.getStatusCode());
        if (e.getStatusCode().value() == 429) builder.header("Retry-After", "60");
        return builder.body(Map.of("error", e.getReason() == null ? "요청을 처리하지 못했습니다." : e.getReason()));
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> failed(Exception e) {
        // Provider errors can contain request text or credentials; never return or log them verbatim.
        return ResponseEntity.status(500).body(Map.of("error", "요청을 처리하지 못했습니다."));
    }
    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,
            org.springframework.web.bind.ServletRequestBindingException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<?> malformed(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("error", "입력 형식을 확인해 주세요."));
    }
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> denied(AccessDeniedException e) {
        return ResponseEntity.status(403).body(Map.of("error", "접근 권한이 없습니다."));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> invalid(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "입력 내용을 확인해 주세요."));
    }
}
