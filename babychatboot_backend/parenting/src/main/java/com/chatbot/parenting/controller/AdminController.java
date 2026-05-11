package com.chatbot.parenting.controller;

import com.chatbot.parenting.domain.Board;
import com.chatbot.parenting.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    // ==========================================
    // 관리자 인증 (공개 엔드포인트)
    // ==========================================

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        try {
            String token = adminService.login(body.get("username"), body.get("password"));
            return ResponseEntity.ok(Map.of("token", token));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }

    // ==========================================
    // 관리자 계정 관리
    // ==========================================

    @GetMapping("/admins")
    public ResponseEntity<List<Map<String, Object>>> getAdmins() {
        return ResponseEntity.ok(adminService.getAllAdmins());
    }

    @PostMapping("/admins")
    public ResponseEntity<?> createAdmin(@RequestBody Map<String, String> body) {
        try {
            Map<String, Object> result = adminService.createAdminAccount(
                body.get("username"),
                body.get("password"),
                body.getOrDefault("name", "관리자")
            );
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/admins/{adminId}/active")
    public ResponseEntity<Void> setAdminActive(@PathVariable Long adminId,
                                                @RequestBody Map<String, Boolean> body) {
        adminService.setAdminActive(adminId, body.get("active"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/admins/{adminId}")
    public ResponseEntity<Void> deleteAdmin(@PathVariable Long adminId) {
        adminService.deleteAdmin(adminId);
        return ResponseEntity.ok().build();
    }

    // ==========================================
    // 대시보드
    // ==========================================

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    // ==========================================
    // 회원 관리 (일반 사용자)
    // ==========================================

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @DeleteMapping("/users/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
        adminService.deleteUser(userId);
        return ResponseEntity.ok().build();
    }

    // ==========================================
    // 게시물 관리
    // ==========================================

    @GetMapping("/posts")
    public ResponseEntity<?> getPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(adminService.getAllPosts(pageable));
    }

    @DeleteMapping("/posts/{postId}")
    public ResponseEntity<Void> deletePost(@PathVariable Long postId) {
        adminService.deletePost(postId);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/posts/{postId}/restore")
    public ResponseEntity<Void> restorePost(@PathVariable Long postId) {
        adminService.restorePost(postId);
        return ResponseEntity.ok().build();
    }

    // ==========================================
    // 게시판 관리
    // ==========================================

    @GetMapping("/boards")
    public ResponseEntity<List<Board>> getBoards() {
        return ResponseEntity.ok(adminService.getAllBoards());
    }

    @PostMapping("/boards")
    public ResponseEntity<Board> createBoard(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String description = (String) body.get("description");
        Integer displayOrder = (Integer) body.get("displayOrder");
        String boardType = (String) body.get("boardType");
        return ResponseEntity.ok(adminService.createBoard(name, description, displayOrder, boardType));
    }

    @PutMapping("/boards/{boardId}")
    public ResponseEntity<Board> updateBoard(@PathVariable Long boardId,
                                              @RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String description = (String) body.get("description");
        Integer displayOrder = (Integer) body.get("displayOrder");
        String boardType = (String) body.get("boardType");
        return ResponseEntity.ok(adminService.updateBoard(boardId, name, description, displayOrder, boardType));
    }

    @PatchMapping("/boards/{boardId}/active")
    public ResponseEntity<Void> setBoardActive(@PathVariable Long boardId,
                                                @RequestBody Map<String, Boolean> body) {
        adminService.setBoardActive(boardId, body.get("active"));
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/boards/{boardId}")
    public ResponseEntity<Void> deleteBoard(@PathVariable Long boardId) {
        adminService.deleteBoard(boardId);
        return ResponseEntity.ok().build();
    }

    // ==========================================
    // 공지사항 관리
    // ==========================================

    @GetMapping("/notices")
    public ResponseEntity<List<Map<String, Object>>> getNotices() {
        return ResponseEntity.ok(adminService.getAllNotices());
    }

    @PostMapping("/notices")
    public ResponseEntity<Map<String, Object>> createNotice(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal String adminUsername) {
        String title = (String) body.get("title");
        String content = (String) body.get("content");
        boolean pinned = Boolean.TRUE.equals(body.get("pinned"));
        return ResponseEntity.ok(adminService.createNotice(title, content, pinned, adminUsername));
    }

    @PutMapping("/notices/{noticeId}")
    public ResponseEntity<Void> updateNotice(@PathVariable Long noticeId,
                                              @RequestBody Map<String, Object> body) {
        String title = (String) body.get("title");
        String content = (String) body.get("content");
        boolean pinned = Boolean.TRUE.equals(body.get("pinned"));
        adminService.updateNotice(noticeId, title, content, pinned);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/notices/{noticeId}")
    public ResponseEntity<Void> deleteNotice(@PathVariable Long noticeId) {
        adminService.deleteNotice(noticeId);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/notices/{noticeId}/active")
    public ResponseEntity<Void> setNoticeActive(@PathVariable Long noticeId,
                                                 @RequestBody Map<String, Boolean> body) {
        adminService.setNoticeActive(noticeId, body.get("active"));
        return ResponseEntity.ok().build();
    }

    // ==========================================
    // 챗봇 설정 관리
    // ==========================================

    @GetMapping("/chatbot/configs")
    public ResponseEntity<List<Map<String, Object>>> getChatbotConfigs() {
        return ResponseEntity.ok(adminService.getAllChatbotConfigs());
    }

    @PutMapping("/chatbot/configs")
    public ResponseEntity<Void> updateChatbotConfig(@RequestBody Map<String, String> body) {
        adminService.updateChatbotConfig(body.get("key"), body.get("value"));
        return ResponseEntity.ok().build();
    }

    // ==========================================
    // 문서/임베딩 관리
    // ==========================================

    @PostMapping("/knowledge")
    public ResponseEntity<Map<String, Object>> addKnowledge(@RequestBody Map<String, String> body) {
        String content = body.get("content");
        String source = body.getOrDefault("source", "admin_manual");
        adminService.addKnowledge(content, source);
        return ResponseEntity.ok(Map.of("message", "지식이 벡터스토어에 추가되었습니다.", "source", source));
    }

    @PostMapping("/knowledge/upload")
    public ResponseEntity<?> uploadKnowledge(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "source", required = false) String source) {
        try {
            Map<String, Object> result = adminService.uploadKnowledgeFile(file, source);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ==========================================
    // 채팅 내역 관리
    // ==========================================

    @GetMapping("/chats")
    public ResponseEntity<List<Map<String, Object>>> searchChats(
            @RequestParam(required = false) String searchType,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        java.time.LocalDateTime start = (startDate != null && !startDate.isBlank())
                ? java.time.LocalDate.parse(startDate).atStartOfDay() : null;
        java.time.LocalDateTime end = (endDate != null && !endDate.isBlank())
                ? java.time.LocalDate.parse(endDate).atTime(23, 59, 59) : null;
        return ResponseEntity.ok(adminService.searchChatRooms(searchType, keyword, start, end));
    }

    @GetMapping("/chats/{roomId}/messages")
    public ResponseEntity<List<Map<String, Object>>> getChatMessages(@PathVariable String roomId) {
        return ResponseEntity.ok(adminService.getAdminChatMessages(roomId));
    }

    // ==========================================
    // 일지 관리
    // ==========================================

    @GetMapping("/dailylogs")
    public ResponseEntity<?> getDailyLogs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String searchType,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String diaperType,
            @RequestParam(required = false, defaultValue = "ALL") String breastfed,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        Pageable pageable = PageRequest.of(page, size);
        java.time.LocalDateTime start = (startDate != null && !startDate.isBlank())
                ? java.time.LocalDate.parse(startDate).atStartOfDay() : null;
        java.time.LocalDateTime end = (endDate != null && !endDate.isBlank())
                ? java.time.LocalDate.parse(endDate).atTime(23, 59, 59) : null;
        return ResponseEntity.ok(adminService.getAllDailyLogs(searchType, keyword, diaperType, breastfed, start, end, pageable));
    }

    @DeleteMapping("/dailylogs/{logId}")
    public ResponseEntity<Void> deleteDailyLog(@PathVariable Long logId) {
        adminService.deleteDailyLog(logId);
        return ResponseEntity.ok().build();
    }
}
