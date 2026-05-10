package com.chatbot.parenting.controller;

import com.chatbot.parenting.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notices")
@RequiredArgsConstructor
public class NoticeController {

    private final AdminService adminService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getPublicNotices() {
        return ResponseEntity.ok(adminService.getActiveNotices());
    }
}
