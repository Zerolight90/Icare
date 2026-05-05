package com.chatbot.parenting.controller;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.DailyLogRequestDto;
import com.chatbot.parenting.dto.DailyLogResponseDto;
import com.chatbot.parenting.repository.BabyRepository;
import com.chatbot.parenting.repository.UserRepository;
import com.chatbot.parenting.service.DailyLogService;
import com.chatbot.parenting.service.GeminiService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
public class DailyLogController {

    private final DailyLogService dailyLogService;
    private final GeminiService geminiService;
    private final BabyRepository babyRepository;
    private final UserRepository userRepository;

    @GetMapping("/{babyId}")
    public ResponseEntity<?> getLogs(
            @PathVariable Long babyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal Object principal) {
        if (extractEmail(principal) == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (date == null) date = LocalDate.now();
        try {
            return ResponseEntity.ok(dailyLogService.getLogs(babyId, date));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/{babyId}/range")
    public ResponseEntity<?> getLogsByRange(
            @PathVariable Long babyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Object principal) {
        if (extractEmail(principal) == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(dailyLogService.getLogsByRange(babyId, from, to));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // CSV 내보내기 GET /api/logs/{babyId}/export?from=...&to=...
    @GetMapping("/{babyId}/export")
    public void exportCsv(
            @PathVariable Long babyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal Object principal,
            HttpServletResponse response) throws IOException {

        if (extractEmail(principal) == null) { response.setStatus(401); return; }

        Baby baby = babyRepository.findById(babyId).orElseThrow();
        List<DailyLogResponseDto> rows = dailyLogService.getLogsByRange(babyId, from, to);

        String rawName = baby.getName() + "_일과표_" + from + "_" + to + ".csv";
        String encoded = URLEncoder.encode(rawName, StandardCharsets.UTF_8).replace("+", "%20");

        response.setContentType("text/csv; charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encoded);
        response.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

        // UTF-8 BOM 직접 쓰기
        response.getOutputStream().write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

        PrintWriter pw = new PrintWriter(new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8));
        pw.println("날짜시간,분유량(ml),수유,기저귀,메모,작성자");

        for (DailyLogResponseDto r : rows) {
            pw.printf("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"%n",
                    safe(r.getRecordTime()),
                    r.getFormulaAmount() != null ? r.getFormulaAmount() : "",
                    Boolean.TRUE.equals(r.getBreastfed()) ? "O" : "",
                    diaperLabel(r.getDiaperType()),
                    safe(r.getMemo()),
                    safe(r.getWriterNickname()));
        }
        pw.flush();
    }

    private String safe(String s) { return s != null ? s.replace("\"", "\"\"") : ""; }
    private String diaperLabel(String t) {
        if (t == null) return "-";
        return switch (t) { case "WET" -> "소변"; case "DIRTY" -> "대변"; case "BOTH" -> "소변+대변"; default -> "-"; };
    }

    // AI 건강 문진 POST /api/logs/{babyId}/health-check?date=...
    @PostMapping("/{babyId}/health-check")
    public ResponseEntity<?> healthCheck(
            @PathVariable Long babyId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal Object principal) {
        if (extractEmail(principal) == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        Baby baby = babyRepository.findById(babyId)
                .orElseThrow(() -> new IllegalArgumentException("아이 정보를 찾을 수 없습니다."));

        List<DailyLogResponseDto> logs = dailyLogService.getLogs(babyId, date);
        if (logs.isEmpty()) return ResponseEntity.ok(Map.of("result", "해당 날짜에 기록된 일과가 없습니다."));

        Period age = Period.between(baby.getBirthDate(), LocalDate.now());
        String ageStr = age.getMonths() == 0 && age.getYears() == 0
                ? age.getDays() + "일"
                : age.getYears() > 0 ? age.getYears() + "년 " + age.getMonths() + "개월"
                : age.getMonths() + "개월";

        int totalFormula = logs.stream()
                .filter(l -> l.getFormulaAmount() != null)
                .mapToInt(DailyLogResponseDto::getFormulaAmount).sum();
        long breastfeeds = logs.stream().filter(l -> Boolean.TRUE.equals(l.getBreastfed())).count();
        long diaperWet = logs.stream().filter(l -> "WET".equals(l.getDiaperType()) || "BOTH".equals(l.getDiaperType())).count();
        long diaperDirty = logs.stream().filter(l -> "DIRTY".equals(l.getDiaperType()) || "BOTH".equals(l.getDiaperType())).count();

        StringBuilder prompt = new StringBuilder();
        prompt.append("아이 이름: ").append(baby.getName()).append(", 나이: ").append(ageStr);
        if (baby.getWeight() != null) prompt.append(", 체중: ").append(baby.getWeight()).append("kg");
        if (baby.getHeight() != null) prompt.append(", 신장: ").append(baby.getHeight()).append("cm");
        if (baby.getSpecialNotes() != null && !baby.getSpecialNotes().isBlank())
            prompt.append(", 특이사항: ").append(baby.getSpecialNotes());
        prompt.append("\n\n오늘(").append(date).append(") 일과 기록:\n");
        prompt.append("- 분유 총량: ").append(totalFormula).append("ml (").append(logs.stream().filter(l -> l.getFormulaAmount() != null).count()).append("회)\n");
        prompt.append("- 모유수유: ").append(breastfeeds).append("회\n");
        prompt.append("- 소변 기저귀: ").append(diaperWet).append("회\n");
        prompt.append("- 대변 기저귀: ").append(diaperDirty).append("회\n");
        prompt.append("- 메모: ");
        logs.stream().filter(l -> l.getMemo() != null && !l.getMemo().isBlank())
                .forEach(l -> prompt.append(l.getMemo()).append(" / "));
        prompt.append("\n\n위 데이터를 바탕으로 오늘 수유량과 배변이 적절한지, 주의할 점은 없는지 친절하게 문진해주세요.");

        String result = geminiService.healthCheck(prompt.toString());
        return ResponseEntity.ok(Map.of("result", result));
    }

    @PostMapping("/{babyId}")
    public ResponseEntity<?> addLog(
            @PathVariable Long babyId,
            @RequestBody DailyLogRequestDto dto,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(dailyLogService.addLog(email, babyId, dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/entry/{logId}")
    public ResponseEntity<?> updateLog(
            @PathVariable Long logId,
            @RequestBody DailyLogRequestDto dto,
            @AuthenticationPrincipal Object principal) {
        if (extractEmail(principal) == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(dailyLogService.updateLog(logId, dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/entry/{logId}")
    public ResponseEntity<?> deleteLog(
            @PathVariable Long logId,
            @AuthenticationPrincipal Object principal) {
        if (extractEmail(principal) == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            dailyLogService.deleteLog(logId);
            return ResponseEntity.ok("삭제되었습니다.");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private String extractEmail(Object principal) {
        if (principal instanceof org.springframework.security.core.userdetails.UserDetails ud)
            return ud.getUsername();
        if (principal instanceof String s) return s;
        return null;
    }
}
