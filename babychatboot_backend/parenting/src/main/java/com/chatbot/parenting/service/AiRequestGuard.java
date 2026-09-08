package com.chatbot.parenting.service;

import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class AiRequestGuard {
    private final int inputChars;
    private final int outputTokens;
    private final int callsPerMinute;
    private final Map<String, Window> windows = new HashMap<>();
    private static class Window { long start; int calls; boolean busy; Window(long now) { start = now; } }

    public AiRequestGuard(@Value("${icare.ai.max-input-chars:4000}") int inputChars,
            @Value("${icare.ai.max-output-tokens:1024}") int outputTokens,
            @Value("${icare.ai.calls-per-minute:5}") int callsPerMinute) {
        if (inputChars < 1 || inputChars > 8000 || outputTokens < 1 || outputTokens > 2048 || callsPerMinute < 1 || callsPerMinute > 10)
            throw new IllegalArgumentException("AI limits exceed private-test bounds");
        this.inputChars = inputChars; this.outputTokens = outputTokens; this.callsPerMinute = callsPerMinute;
    }

    public int outputTokens() { return outputTokens; }

    public synchronized Permit acquire(String key, String input) {
        if (key == null || key.isBlank()) throw new org.springframework.security.access.AccessDeniedException("인증이 필요합니다.");
        if (input == null || input.isBlank() || input.length() > inputChars)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "AI 입력은 최대 " + inputChars + "자입니다.");
        long now = System.nanoTime();
        windows.entrySet().removeIf(e -> !e.getValue().busy && now - e.getValue().start >= 60_000_000_000L);
        if (!windows.containsKey(key) && windows.size() >= 16) throw limited();
        Window w = windows.computeIfAbsent(key, k -> new Window(now));
        if (w.busy || w.calls >= callsPerMinute) throw limited();
        w.calls++; w.busy = true;
        return new Permit(w);
    }

    private ResponseStatusException limited() { return new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "잠시 후 다시 요청해 주세요."); }

    public class Permit implements AutoCloseable {
        private final Window window;
        private boolean closed;
        private Permit(Window window) { this.window = window; }
        @Override public void close() {
            if (closed) return;
            closed = true;
            // The next conversation request must see the previous transaction's committed messages.
            if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
                org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                    new org.springframework.transaction.support.TransactionSynchronization() {
                        @Override public void afterCompletion(int status) { release(); }
                    });
            } else release();
        }
        private void release() { synchronized (AiRequestGuard.this) { window.busy = false; } }
    }
}
