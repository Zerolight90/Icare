package com.chatbot.parenting.controller;

import com.chatbot.parenting.dto.PostRequestDto;
import com.chatbot.parenting.service.CommunityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService communityService;

    // 게시판 목록 GET /api/community/boards?type=COMMUNITY
    @GetMapping("/boards")
    public ResponseEntity<?> getBoards(@RequestParam(required = false) String type) {
        return ResponseEntity.ok(communityService.getBoards(type));
    }

    // 게시글 목록 GET /api/community/boards/{boardId}/posts?page=0&size=10
    @GetMapping("/boards/{boardId}/posts")
    public ResponseEntity<?> getPosts(
            @PathVariable Long boardId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        try {
            return ResponseEntity.ok(communityService.getPosts(boardId, page, size));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 게시글 상세 GET /api/community/posts/{postId}
    @GetMapping("/posts/{postId}")
    public ResponseEntity<?> getPost(@PathVariable Long postId) {
        try {
            return ResponseEntity.ok(communityService.getPost(postId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 게시글 작성 POST /api/community/boards/{boardId}/posts
    @PostMapping("/boards/{boardId}/posts")
    public ResponseEntity<?> createPost(
            @PathVariable Long boardId,
            @RequestBody PostRequestDto dto,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(communityService.createPost(email, boardId, dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 게시글 수정 PUT /api/community/posts/{postId}
    @PutMapping("/posts/{postId}")
    public ResponseEntity<?> updatePost(
            @PathVariable Long postId,
            @RequestBody PostRequestDto dto,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            communityService.updatePost(email, postId, dto);
            return ResponseEntity.ok("수정되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 게시글 삭제 DELETE /api/community/posts/{postId}
    @DeleteMapping("/posts/{postId}")
    public ResponseEntity<?> deletePost(
            @PathVariable Long postId,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            communityService.deletePost(email, postId);
            return ResponseEntity.ok("삭제되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 댓글 추가 POST /api/community/posts/{postId}/comments
    @PostMapping("/posts/{postId}/comments")
    public ResponseEntity<?> addComment(
            @PathVariable Long postId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(communityService.addComment(email, postId, body.get("content")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 댓글 삭제 DELETE /api/community/comments/{commentId}
    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<?> deleteComment(
            @PathVariable Long commentId,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            communityService.deleteComment(email, commentId);
            return ResponseEntity.ok("삭제되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private String extractEmail(Object principal) {
        if (principal instanceof String) return (String) principal;
        return null;
    }
}
