package com.chatbot.parenting;

import com.chatbot.parenting.service.RequestControl;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Unit-test double only. Production always uses Redis. */
class FakeRequestControl implements RequestControl {
    private final Map<String, String> owners = new HashMap<>();
    private final Map<String, Integer> calls = new HashMap<>();
    private int auth;
    public String acquire(String key, int limit) {
        if (owners.containsKey(key) || calls.getOrDefault(key, 0) >= limit)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
        String token = UUID.randomUUID().toString(); owners.put(key, token); calls.merge(key, 1, Integer::sum); return token;
    }
    public void check(String key, String token) {
        if (!token.equals(owners.get(key))) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    }
    public void release(String key, String token) { owners.remove(key, token); }
    public boolean allowAuthAttempt() { return ++auth <= 20; }
}
