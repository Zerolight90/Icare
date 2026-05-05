package com.chatbot.parenting.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
@RequestMapping("/api/hospitals")
@RequiredArgsConstructor
public class HospitalController {

    @Value("${kakao.rest-api-key:}")
    private String kakaoRestApiKey;

    private final RestTemplate restTemplate;

    /**
     * Kakao Local API 프록시 - 주변 병원 검색
     * GET /api/hospitals?x=127.0&y=37.5&radius=2000&query=소아청소년과
     */
    @GetMapping
    public ResponseEntity<?> searchHospitals(
            @RequestParam double x,
            @RequestParam double y,
            @RequestParam(defaultValue = "2000") int radius,
            @RequestParam(defaultValue = "소아청소년과") String query) {

        if (kakaoRestApiKey == null || kakaoRestApiKey.isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body("Kakao REST API 키가 설정되지 않았습니다. application-secret.yml에 kakao.rest-api-key를 추가해주세요.");
        }

        String url = UriComponentsBuilder
                .fromHttpUrl("https://dapi.kakao.com/v2/local/search/keyword.json")
                .queryParam("query", query)
                .queryParam("x", x)
                .queryParam("y", y)
                .queryParam("radius", Math.min(radius, 20000))
                .queryParam("category_group_code", "HP8")
                .queryParam("size", 15)
                .queryParam("sort", "distance")
                .build()
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "KakaoAK " + kakaoRestApiKey);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.GET, entity, String.class);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body("병원 검색 중 오류가 발생했습니다: " + e.getMessage());
        }
    }
}
