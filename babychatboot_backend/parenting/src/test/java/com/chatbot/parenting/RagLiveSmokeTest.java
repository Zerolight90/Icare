package com.chatbot.parenting;

import com.chatbot.parenting.domain.*;
import com.chatbot.parenting.repository.*;
import com.chatbot.parenting.service.GeminiService;
import com.chatbot.parenting.util.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.autoconfigure.web.servlet.*;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Explicitly approved live Gemini calls, isolated DB + synthetic identities only. Never part of normal tests. */
@EnabledIfEnvironmentVariable(named="ICARE_RAG_LIVE_APPROVED", matches="true")
@SpringBootTest(properties={"spring.profiles.active=private", "spring.flyway.enabled=false", "icare.knowledge.batch-enabled=false",
        "icare.knowledge.load-on-startup=false", "icare.admin.bootstrap.enabled=false", "icare.bootstrap.enabled=false"})
@AutoConfigureMockMvc(print=MockMvcPrint.NONE)
class RagLiveSmokeTest {
    @DynamicPropertySource static void isolated(DynamicPropertyRegistry properties) {
        String url = System.getenv("ICARE_RAG_LIVE_JDBC_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:55432/icare_validation_[a-z0-9_]+"))
            throw new IllegalArgumentException("Live test requires the explicit loopback validation database.");
        properties.add("spring.datasource.url", () -> url);
        properties.add("spring.datasource.username", () -> System.getenv("ICARE_TEST_DB_USER"));
        properties.add("spring.datasource.password", () -> System.getenv("ICARE_TEST_DB_PASSWORD"));
        properties.add("icare.redis.prefix", () -> "icare:rag-live:" + "20260919:");
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired BabyRepository babies;
    @Autowired FamilyRepository families;
    @Autowired JwtUtil jwt;
    @Autowired JdbcTemplate jdbc;
    @Value("${icare.security.proxy-secret}") String proxy;

    @Test void registeredKnowledgeSupportsRealChatAndDailyAnalysis() throws Exception {
        Path output = Path.of(Objects.requireNonNull(System.getenv("ICARE_RAG_LIVE_REPORT")));
        assertThat(Files.exists(output)).as("Each approved run requires a fresh report; no silent reruns").isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM knowledge_revision WHERE active", Integer.class)).isEqualTo(5);
        String suffix = UUID.randomUUID().toString().substring(0, 6);
        var family = families.save(new Family(suffix));
        String email = "rag-" + suffix + "@example.test";
        var user = new User(email, new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode(UUID.randomUUID().toString()),
                "LOCAL", "합성 보호자", "합성 보호자", "MOM", LocalDate.of(1990,1,1), null, null);
        user.verifyEmail(); user.joinFamily(family); user = users.save(user);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        var baby = babies.save(new Baby("합성 아이", "U", today.minusMonths(3), family));
        var older = babies.save(new Baby("범위 밖 합성 아이", "U", today.minusMonths(24), family));
        String token = jwt.createUserToken(email, "MOM");
        jdbc.update("INSERT INTO daily_logs(record_time,formula_amount,breastfed,diaper_type,memo,baby_id,user_id,created_at) VALUES (?,NULL,false,'NONE','보호자가 일부 항목만 기록한 합성 검수 자료',?,?,?)",
                java.sql.Timestamp.valueOf(today.atTime(12,0)), baby.getId(), user.getId(), java.sql.Timestamp.valueOf(today.atTime(12,0)));
        try (var report = Files.newBufferedWriter(output, StandardOpenOption.CREATE_NEW)) {
            boolean dailyOnly = "true".equals(System.getenv("ICARE_RAG_LIVE_DAILY_ONLY"));
            if (!dailyOnly) {
            String room = room(token, baby.getId());
            String question = "생후 3개월 아기의 안전한 수면 자세와 잠자리를 알려주세요. 미국 자료는 미국 권고라고 구분해 주세요.";
            String answer = chat(token, room, question);
            var history = json.readTree(mvc.perform(get("/api/chat/rooms/"+room+"/messages").header("Authorization","Bearer "+token)
                    .header("X-Icare-Proxy-Secret",proxy)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
            write(report, Map.of("case","sleep_chat","question",question,"answer",answer,"sources",history.get(1).path("retrievalSources").asText()));
            assertThat(answer).isNotEqualTo(GeminiService.NO_EVIDENCE).contains("[자료 ");
            assertThat(history.get(1).path("retrievalSources").asText()).contains("nichd.nih.gov");
            }
            var daily = json.readTree(mvc.perform(post("/api/logs/"+baby.getId()+"/health-check").param("date",today.toString())
                    .header("Authorization","Bearer "+token).header("X-Icare-Proxy-Secret",proxy))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
            write(report, Map.of("case","daily_missing_records","response",daily));
            assertThat(daily.path("status").asText()).isEqualTo("answered");
            assertThat(daily.path("result").asText()).contains("[자료 ");
            assertThat(daily.path("retrievalSources").asText()).doesNotContain("cdc.gov", "nichd.nih.gov", "nip.kdca.go.kr");
            assertThat(daily.path("result").asText()).doesNotContain("4개월", "머리를 지지");
            if (dailyOnly) return;
            String outOfScope = chat(token, room(token, older.getId()), "24개월 아이 수면 안내를 알려주세요.");
            write(report, Map.of("case","unsupported_age","answer",outOfScope));
            assertThat(outOfScope).isEqualTo(GeminiService.NO_EVIDENCE);
            String unrelated = chat(token, room(token, baby.getId()), "양자 컴퓨터의 쇼어 알고리즘으로 소인수분해하는 코드를 작성해 주세요.");
            write(report, Map.of("case","unrelated","answer",unrelated));
            assertThat(unrelated).isEqualTo(GeminiService.NO_EVIDENCE);
        }
    }
    private String room(String token, Long baby) throws Exception {
        var result = mvc.perform(post("/api/chat/rooms").param("title","합성 검수").param("babyId",baby.toString())
                .header("Authorization","Bearer "+token).header("X-Icare-Proxy-Secret",proxy))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(result).path("id").asText();
    }
    private String chat(String token, String room, String question) throws Exception {
        return mvc.perform(post("/api/chat/message").param("roomId",room).param("message",question)
                .header("Authorization","Bearer "+token).header("X-Icare-Proxy-Secret",proxy))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
    }
    private void write(java.io.Writer report, Object value) throws Exception { report.write(json.writeValueAsString(value)+"\n"); report.flush(); }
}
