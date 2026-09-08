import java.net.URI;
import java.net.http.*;
import java.time.Duration;

/** Runs inside the offline validation network, never against the service database. */
public class PrivateBackendSmoke {
    static final String BASE = "http://127.0.0.1:8080";
    static final String PROXY = "test-proxy-secret-with-at-least-32-characters";
    static final String PASSWORD = "test-only-long-password";
    static HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    static int checks;

    static String roomId(String json) {
        var match = java.util.regex.Pattern.compile("\"id\":\"([a-z0-9-]+)\"").matcher(json);
        if (!match.find()) throw new IllegalStateException("Room id missing");
        return match.group(1);
    }

    static HttpResponse<String> call(String method, String path, String body, String token, boolean proxy, int expected) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create(BASE + path)).timeout(Duration.ofSeconds(10));
        if (proxy) builder.header("X-Icare-Proxy-Secret", PROXY);
        if (token != null) builder.header("Authorization", "Bearer " + token);
        builder.header("Content-Type", "application/json");
        var result = client.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
        if (result.statusCode() != expected) throw new IllegalStateException(method + " " + path + ": expected " + expected + ", got " + result.statusCode());
        checks++; return result;
    }

    public static void main(String[] args) throws Exception {
        call("GET", "/healthz", null, null, false, 200);
        call("GET", "/api/users/profile", null, null, false, 403);
        call("GET", "/api/users/profile", null, null, true, 401);
        if (args[0].equals("signup")) {
            call("POST", "/api/users/signup", "{\"email\":\"parent@example.test\",\"role\":\"ADMIN\"}", null, true, 400);
            call("POST", "/api/users/signup", "{\"email\":\"outsider@example.test\",\"role\":\"MOM\"}", null, true, 403);
            for (String email : new String[]{"parent@example.test", "second@example.test"}) {
                String body = "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"name\":\"Test\",\"nickname\":\"Test\",\"role\":\"MOM\",\"babyCount\":1,\"babyNames\":[\"Test baby\"],\"babyGenders\":[\"U\"],\"babyBirthDate\":\"2026-08-01\"}";
                call("POST", "/api/users/signup", body, null, true, 200);
            }
        } else {
            String login = "{\"email\":\"parent@example.test\",\"password\":\"" + PASSWORD + "\"}";
            String token = call("POST", "/api/users/login", login, null, true, 200).body();
            if (args[0].equals("context")) {
                String general = call("POST", "/api/chat/rooms?title=general", null, token, true, 200).body();
                if (!general.contains("\"contextVersion\":1") || !general.contains("\"contextBabyId\":null")
                        || general.contains("contextFamilyId") || general.contains("parent@example.test"))
                    throw new IllegalStateException("General context or serialization failed");
                checks++;
                String selected = call("POST", "/api/chat/rooms?title=selected&babyId=1", null, token, true, 200).body();
                if (!selected.contains("\"contextBabyId\":1")) throw new IllegalStateException("Selected baby missing");
                checks++;
                call("POST", "/api/chat/rooms?title=foreign&babyId=2", null, token, true, 403);
                call("POST", "/api/chat/rooms?title=" + "x".repeat(121), null, token, true, 400);
                String second = call("POST", "/api/users/login", "{\"email\":\"second@example.test\",\"password\":\"" + PASSWORD + "\"}", null, true, 200).body();
                call("GET", "/api/chat/rooms/" + roomId(selected) + "/messages", null, second, true, 403);
                call("POST", "/api/chat/message?roomId=" + roomId(selected) + "&message=question", null, second, true, 403);
                call("POST", "/api/chat/message?roomId=" + roomId(general) + "&message=" + "x".repeat(4001), null, token, true, 400);
                call("GET", "/api/chat/rooms/legacy-context-smoke/messages", null, token, true, 200);
                call("POST", "/api/chat/message?roomId=legacy-context-smoke&message=question", null, token, true, 409);
                System.out.println("Offline context HTTP checks passed: " + checks);
                return;
            }
            call("GET", "/api/users/profile", null, token, true, 200);
            call("GET", "/api/admin/stats", null, token, true, 403);
            var logs = call("GET", "/api/logs/1?date=2026-09-08", null, token, true, 200).body();
            if (!logs.contains("2026-09-08T00:00") || logs.contains("2026-09-09")) throw new IllegalStateException("Date boundary failed");
            checks++;
            call("GET", "/api/logs/1/export?from=2026-09-08&to=2026-09-08", null, token, true, 200);
            call("GET", "/api/logs/2?date=2026-09-08", null, token, true, 403);
            call("GET", "/api/logs/2/export?from=2026-09-08&to=2026-09-08", null, token, true, 403);
            call("POST", "/api/logs/2/health-check?date=2026-09-08", null, token, true, 403);
            call("POST", "/api/logs/2", "{}", token, true, 403);
            call("PUT", "/api/logs/entry/3", "{}", token, true, 403);
            call("DELETE", "/api/logs/entry/3", null, token, true, 403);
            call("PUT", "/api/babies/2", "{}", token, true, 403);
            call("DELETE", "/api/babies/2", null, token, true, 403);
            call("POST", "/api/users/login", "{\"email\":\"outsider@example.test\",\"password\":\"bad\"}", null, true, 403);
            call("POST", "/api/users/send-email?email=outsider@example.test", null, null, true, 403);
        }
        System.out.println("Offline backend HTTP checks passed: " + checks);
    }
}
