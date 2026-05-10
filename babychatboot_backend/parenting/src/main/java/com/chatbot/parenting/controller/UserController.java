package com.chatbot.parenting.controller;

import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.*;
import com.chatbot.parenting.repository.UserRepository;
import com.chatbot.parenting.service.EmailService;
import com.chatbot.parenting.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final EmailService emailService;
    private final UserRepository userRepository;

    // 회원가입
    @PostMapping("/signup")
    public ResponseEntity<String> signup(@RequestBody SignupRequestDto requestDto) {
        try {
            return ResponseEntity.ok(userService.signup(requestDto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 이메일 인증번호 발송
    @PostMapping("/send-email")
    public ResponseEntity<String> sendVerificationEmail(@RequestParam String email) {
        try {
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("가입된 이메일이 아닙니다."));
            String code = emailService.generateVerificationCode();
            user.setVerificationCode(code);
            userRepository.save(user);
            emailService.sendVerificationEmail(email, code);
            System.out.println("발송된 인증번호: " + code);
            return ResponseEntity.ok("이메일로 인증번호가 발송되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("이메일 발송에 실패했습니다.");
        }
    }

    // 이메일 인증 확인
    @PostMapping("/verify")
    public ResponseEntity<String> verify(@RequestParam String email, @RequestParam String code) {
        try {
            boolean isSuccess = userService.verifyEmail(email, code);
            if (isSuccess) return ResponseEntity.ok("이메일 인증에 성공했습니다! 이제 로그인이 가능합니다.");
            return ResponseEntity.badRequest().body("인증번호가 일치하지 않습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 로그인
    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequestDto loginRequestDto) {
        try {
            return ResponseEntity.ok(userService.login(loginRequestDto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 내 닉네임 조회 (헤더용 간소화 버전)
    @GetMapping("/me")
    public ResponseEntity<?> getMyInfo(@AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("인증 정보가 없습니다.");

        return userRepository.findByEmail(email)
                .map(user -> {
                    String nickname = user.getNickname() != null ? user.getNickname() : "";
                    return ResponseEntity.ok(Map.of("nickname", nickname));
                })
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    // ==========================================
    // 마이페이지 API
    // ==========================================

    // 전체 프로필 조회
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            return ResponseEntity.ok(userService.getProfile(email));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 회원정보 수정
    @PutMapping("/profile")
    public ResponseEntity<String> updateProfile(
            @AuthenticationPrincipal Object principal,
            @RequestBody UpdateProfileRequestDto dto) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            userService.updateProfile(email, dto);
            return ResponseEntity.ok("회원정보가 수정되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 비밀번호 변경
    @PutMapping("/password")
    public ResponseEntity<String> changePassword(
            @AuthenticationPrincipal Object principal,
            @RequestBody ChangePasswordRequestDto dto) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            userService.changePassword(email, dto);
            return ResponseEntity.ok("비밀번호가 변경되었습니다.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 가족 초대코드로 합류
    @PostMapping("/family/join")
    public ResponseEntity<String> joinFamily(
            @AuthenticationPrincipal Object principal,
            @RequestBody Map<String, String> body) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            String inviteCode = userService.joinFamily(email, body.get("inviteCode"));
            return ResponseEntity.ok("가족 그룹에 합류했습니다. (코드: " + inviteCode + ")");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    private String extractEmail(Object principal) {
        if (principal instanceof String) return (String) principal;
        return null;
    }
}
