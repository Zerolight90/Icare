package com.chatbot.parenting.controller;

import com.chatbot.parenting.service.GeminiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
@RequestMapping("/api/chat")
public class ChatController {

    private final GeminiService geminiService;

    // 1. 방 목록 가져오기
    @GetMapping("/rooms")
    public ResponseEntity<?> getRooms() {
        return ResponseEntity.ok(geminiService.getAllRooms());
    }

    // 2. 새 방 만들기
    @PostMapping("/rooms")
    public ResponseEntity<?> createRoom(@RequestParam String title) {
        return ResponseEntity.ok(geminiService.createNewRoom(title));
    }

    // 3. 특정 방의 대화 기록 불러오기 (중복 제거됨!)
    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<?> getRoomMessages(@PathVariable String roomId) {
        return ResponseEntity.ok(geminiService.getChatHistoryByRoom(roomId));
    }

    // 4. 메시지 보내기
    @PostMapping("/message")
    public ResponseEntity<String> chat(
            @RequestParam String roomId, 
            @RequestParam String message
    ) {
        String response = geminiService.askToGemini(roomId, message);
        return ResponseEntity.ok(response);
    }

    // 5. 대화 기록 삭제
    @DeleteMapping("/rooms/{roomId}/messages")
    public ResponseEntity<?> resetRoomMessages(@PathVariable String roomId) {
        geminiService.resetChatHistory(roomId);
        return ResponseEntity.ok().build();
    }
}