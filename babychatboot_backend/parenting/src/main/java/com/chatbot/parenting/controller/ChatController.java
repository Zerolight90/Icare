package com.chatbot.parenting.controller;

import com.chatbot.parenting.service.GeminiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/chat")
public class ChatController {

    private final GeminiService geminiService;

    // 1. 방 목록 가져오기
    @GetMapping("/rooms")
    public ResponseEntity<?> getRooms(@AuthenticationPrincipal String email) {
        return ResponseEntity.ok(geminiService.getRoomsByUser(email));
    }

    // 2. 새 방 만들기
    @PostMapping("/rooms")
    public ResponseEntity<?> createRoom(@RequestParam String title,
                                        @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(geminiService.createNewRoom(title, email));
    }

    // 3. 특정 방의 대화 기록 불러오기
    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<?> getRoomMessages(@PathVariable String roomId,
                                             @AuthenticationPrincipal String email) {
        return ResponseEntity.ok(geminiService.getChatHistoryByRoom(roomId, email));
    }

    // 4. 메시지 보내기
    @PostMapping("/message")
    public ResponseEntity<String> chat(
            @RequestParam String roomId,
            @RequestParam String message,
            @AuthenticationPrincipal String email
    ) {
        String response = geminiService.askToGemini(roomId, message, email);
        return ResponseEntity.ok(response);
    }

    // 5. 대화 기록 삭제
    @DeleteMapping("/rooms/{roomId}/messages")
    public ResponseEntity<?> resetRoomMessages(@PathVariable String roomId,
                                               @AuthenticationPrincipal String email) {
        geminiService.resetChatHistory(roomId, email);
        return ResponseEntity.ok().build();
    }
}