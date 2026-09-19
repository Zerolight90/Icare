package com.chatbot.parenting.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class AiRequestGuard {
    private final int inputChars;
    private final int outputTokens;
    private final int callsPerMinute;
    private final RequestControl control;

    public AiRequestGuard(@Value("${icare.ai.max-input-chars:4000}") int inputChars,
            @Value("${icare.ai.max-output-tokens:1024}") int outputTokens,
            @Value("${icare.ai.calls-per-minute:5}") int callsPerMinute, RequestControl control) {
        if (inputChars < 1 || inputChars > 8000 || outputTokens < 1 || outputTokens > 2048 || callsPerMinute < 1 || callsPerMinute > 10)
            throw new IllegalArgumentException("AI limits exceed private-test bounds");
        this.inputChars = inputChars; this.outputTokens = outputTokens; this.callsPerMinute = callsPerMinute;
        this.control = control;
    }

    public int outputTokens() { return outputTokens; }

    public Permit acquire(String key, String input) {
        if (key == null || key.isBlank()) throw new org.springframework.security.access.AccessDeniedException("인증이 필요합니다.");
        if (input == null || input.isBlank() || input.length() > inputChars)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "AI 입력은 최대 " + inputChars + "자입니다.");
        return new Permit(key, control.acquire(key, callsPerMinute));
    }

    public class Permit implements AutoCloseable {
        private final String key;
        private final String token;
        private boolean closed;
        private Permit(String key, String token) { this.key = key; this.token = token; }
        @Override public void close() {
            if (closed) return;
            closed = true;
            // The next conversation request must see the previous transaction's committed messages.
            if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
                org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override public void beforeCommit(boolean readOnly) { control.check(key, token); }
                        @Override public void afterCompletion(int status) { release(); }
                    });
            } else {
                try { control.check(key, token); } finally { release(); }
            }
        }
        private void release() { control.release(key, token); }
    }
}
