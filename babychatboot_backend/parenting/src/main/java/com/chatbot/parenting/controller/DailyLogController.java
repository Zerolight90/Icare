package com.chatbot.parenting.controller;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.dto.DailyLogRequestDto;
import com.chatbot.parenting.dto.DailyLogResponseDto;
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
import java.util.List;

@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
public class DailyLogController {

    private final DailyLogService dailyLogService;
    private final GeminiService geminiService;
    private final com.chatbot.parenting.service.FamilyAccessService familyAccess;


    @GetMapping("/{babyId}")
    public ResponseEntity<?> getLogs(
            @PathVariable Long babyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal Object principal) {
        if (extractEmail(principal) == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        if (date == null) date = LocalDate.now();
        try {
            return ResponseEntity.ok(dailyLogService.getLogs(extractEmail(principal), babyId, date));
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
            return ResponseEntity.ok(dailyLogService.getLogsByRange(extractEmail(principal), babyId, from, to));
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

        Baby baby = familyAccess.requireBaby(extractEmail(principal), babyId);
        List<DailyLogResponseDto> rows = dailyLogService.getLogsByRange(extractEmail(principal), babyId, from, to);

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

        Baby baby = familyAccess.requireBaby(extractEmail(principal), babyId);

        List<DailyLogResponseDto> logs = dailyLogService.getLogs(extractEmail(principal), babyId, date);
        var input = com.chatbot.parenting.service.DailyLogAiInput.from(baby, date, logs);
        if (logs.isEmpty()) return ResponseEntity.ok(new GeminiService.Analysis("해당 날짜에 기록된 일과가 없습니다. 미기록으로 건강 상태를 판단할 수 없습니다.", "[]", "no_records"));
        return ResponseEntity.ok(geminiService.analyzeDailyLog(input.prompt(), input.query(), input.ageMonths(), extractEmail(principal)));
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
            return ResponseEntity.ok(dailyLogService.updateLog(extractEmail(principal), logId, dto));
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
            dailyLogService.deleteLog(extractEmail(principal), logId);
            return ResponseEntity.ok("삭제되었습니다.");
        } catch (IllegalArgumentException e) {
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
