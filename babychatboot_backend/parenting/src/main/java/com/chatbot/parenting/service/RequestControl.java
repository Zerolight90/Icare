package com.chatbot.parenting.service;

/** Shared request admission. Implementations must never fall back to per-process limits. */
public interface RequestControl {
    String acquire(String subject, int limit);
    void check(String subject, String token);
    void release(String subject, String token);
    boolean allowAuthAttempt();
}
