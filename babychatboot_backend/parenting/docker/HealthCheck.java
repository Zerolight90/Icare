import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class HealthCheck {
    public static void main(String[] args) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:8080/healthz"))
                .timeout(Duration.ofSeconds(3)).GET().build();
        var result = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.discarding());
        System.exit(result.statusCode() == 200 ? 0 : 1);
    }
}
