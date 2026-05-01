package com.chatbot.parenting.controller;

import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.LoginRequestDto;
import com.chatbot.parenting.dto.SignupRequestDto;
import com.chatbot.parenting.repository.UserRepository;
import com.chatbot.parenting.service.EmailService;
import com.chatbot.parenting.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import java.util.Map;


@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final EmailService emailService;
    private final UserRepository userRepository; // 이메일 발송 전 유저 검증 및 인증번호 저장을 위해 사용

    // ==========================================
    // 1. 회원가입 API (POST /api/users/signup)
    // ==========================================
    @PostMapping("/signup")
    public ResponseEntity<String> signup(@RequestBody SignupRequestDto requestDto) {
        try {
            // 서비스 로직(UserService) 호출
            String resultMessage = userService.signup(requestDto);
            
            // 성공 시 200 OK와 함께 초대 코드 메시지 반환
            return ResponseEntity.ok(resultMessage);
            
        } catch (IllegalArgumentException e) {
            // 중복 이메일 등 에러 발생 시 400 Bad Request와 에러 메시지 반환
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 2. 이메일 인증번호 발송 API (POST /api/users/send-email?email=...)
    // ==========================================
    @PostMapping("/send-email")
    public ResponseEntity<String> sendVerificationEmail(@RequestParam String email) {
        try {
            // 1. DB에서 방금 가입한 유저 찾기 (가입 안 된 이메일이면 여기서 에러 발생)
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("가입된 이메일이 아닙니다. 먼저 회원가입을 진행해 주세요."));

            // 2. 6자리 난수 생성
            String code = emailService.generateVerificationCode();
            
            // 3. 생성된 인증번호를 해당 유저 정보에 저장!
            user.setVerificationCode(code);
            userRepository.save(user); 

            // 4. 메일 발송 슛!
            emailService.sendVerificationEmail(email, code);
            
            // (테스트용) 콘솔에 인증번호 띄우기
            System.out.println("발송된 인증번호: " + code); 

            return ResponseEntity.ok("이메일로 인증번호가 발송되었습니다.");
            
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("이메일 발송에 실패했습니다. 메일 서버 설정을 확인해주세요.");
        }
    }

    // ==========================================
    // 3. 이메일 인증 확인 API (POST /api/users/verify?email=...&code=...)
    // ==========================================
    @PostMapping("/verify")
    public ResponseEntity<String> verify(@RequestParam String email, @RequestParam String code) {
        try {
            // UserService의 검증 로직 호출
            boolean isSuccess = userService.verifyEmail(email, code);
            
            if (isSuccess) {
                return ResponseEntity.ok("이메일 인증에 성공했습니다! 이제 로그인이 가능합니다.");
            } else {
                return ResponseEntity.badRequest().body("인증번호가 일치하지 않습니다.");
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // 로그인 API (POST /api/users/login)
    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequestDto loginRequestDto) {
        try {
            String token = userService.login(loginRequestDto);
            // 토큰을 응답 헤더나 바디에 담아서 보냅니다. 일단은 확인을 위해 바디에 보낼게요!
            return ResponseEntity.ok(token);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // ==========================================
    // 5. 내 정보 조회 API (GET /api/users/me)
    // ==========================================
    @GetMapping("/me")
    public ResponseEntity<?> getMyInfo(@AuthenticationPrincipal Object principal) {
        // 🟢 principal이 String(이메일)인지 확인하는 로직 추가
        String email;
        if (principal instanceof String) {
            email = (String) principal;
        } else {
            // 인증 정보가 꼬였을 경우
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("인증 정보가 없습니다.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("유저를 찾을 수 없습니다. (Email: " + email + ")"));
        
        return ResponseEntity.ok(java.util.Map.of(
            "nickname", user.getNickname()
        ));
    }
}