package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.Family;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.LoginRequestDto;
import com.chatbot.parenting.dto.SignupRequestDto;
import com.chatbot.parenting.repository.BabyRepository; // 리포지토리 필요
import com.chatbot.parenting.repository.FamilyRepository; // 리포지토리 필요
import com.chatbot.parenting.repository.UserRepository;
import com.chatbot.parenting.util.JwtUtil;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import java.time.Duration;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final FamilyRepository familyRepository; // FamilyRepository 인터페이스 미리 만들어두세요!
    private final BabyRepository babyRepository;     // BabyRepository 인터페이스 미리 만들어두세요!
    private final PasswordEncoder passwordEncoder; // 우리가 SecurityConfig에 만든 그 암호화 기계!
    private final JwtUtil jwtUtil; // JWT 토큰 생성과 검증을 담당하는 유틸 클래스

    @Transactional
    public String signup(SignupRequestDto requestDto) {
        // 1. 이메일 중복 확인
        if (userRepository.existsByEmail(requestDto.getEmail())) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }

        // 2. 비밀번호 단방향 암호화 (핵심!)
        String encodedPassword = passwordEncoder.encode(requestDto.getPassword());

        Family family;
        // 3. 초대 코드가 있으면 기존 가족에 합류, 없으면 새 가족 생성
        if (requestDto.getInviteCode() != null && !requestDto.getInviteCode().isEmpty()) {
            family = familyRepository.findByInviteCode(requestDto.getInviteCode())
                    .orElseThrow(() -> new IllegalArgumentException("잘못된 초대 코드입니다."));
        } else {
            // 난수로 6자리 초대코드 생성
            String newCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            family = new Family(newCode);
            familyRepository.save(family);
            
            // 새 가족을 만들었으니 아기 정보도 여기서 저장
            Baby baby = new Baby(requestDto.getBabyName(), requestDto.getBabyGender(), requestDto.getBabyBirthDate(), family);
            babyRepository.save(baby);
        }

        // 4. 암호화된 비밀번호와 함께 유저 저장 및 가족 연결
        User user = new User(
                requestDto.getEmail(),
                encodedPassword, // 원본 비번 대신 암호화된 비번 넣기
                "LOCAL",
                requestDto.getName(),
                requestDto.getNickname(), // DB 에러 방지 위해 추가
                requestDto.getRole(),
                requestDto.getBirthDate(),
                requestDto.getPhoneNumber(),
                requestDto.getAddress()
        );
        user.joinFamily(family);
        userRepository.save(user);

        return "회원가입이 완료되었습니다. (초대코드: " + family.getInviteCode() + ")";
    }

    @Transactional
    public boolean verifyEmail(String email, String code) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("해당 이메일의 사용자가 없습니다."));

        // 1. 시간이 만료되었는지 먼저 체크 (3분 = 180초)
        if (user.getCodeCreatedAt() == null || 
            Duration.between(user.getCodeCreatedAt(), LocalDateTime.now()).getSeconds() > 180) {
            throw new IllegalArgumentException("인증 시간이 만료되었습니다. 다시 발송해 주세요.");
        }

        // 2. 번호 일치 여부 체크
        if (user.getVerificationCode() != null && user.getVerificationCode().equals(code)) {
            user.verifyEmail();
            user.setVerificationCode(null);
            return true;
        }
        return false;
    }

    @Transactional(readOnly = true)
    public String login(LoginRequestDto loginRequestDto) {
        // 1. 이메일 확인
        User user = userRepository.findByEmail(loginRequestDto.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("가입되지 않은 이메일입니다."));

        // 2. 비밀번호 확인 (암호화된 비번과 직접 비교)
        if (!passwordEncoder.matches(loginRequestDto.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        // 3. 이메일 인증 여부 확인 (인증 안 된 유저는 로그인 불가하게 설정)
        if (!user.isEmailVerified()) {
            throw new IllegalArgumentException("이메일 인증이 완료되지 않았습니다.");
        }

        // 4. 로그인 성공! 토큰 생성 후 반환
        return jwtUtil.createToken(user.getEmail(), user.getRole());
    }
}