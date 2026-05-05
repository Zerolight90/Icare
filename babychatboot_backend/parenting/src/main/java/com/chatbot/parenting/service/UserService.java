package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.Family;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.*;
import com.chatbot.parenting.repository.BabyRepository;
import com.chatbot.parenting.repository.FamilyRepository;
import com.chatbot.parenting.repository.UserRepository;
import com.chatbot.parenting.util.JwtUtil;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final FamilyRepository familyRepository;
    private final BabyRepository babyRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public String signup(SignupRequestDto requestDto) {
        if (userRepository.existsByEmail(requestDto.getEmail())) {
            throw new IllegalArgumentException("이미 사용 중인 이메일입니다.");
        }

        String encodedPassword = passwordEncoder.encode(requestDto.getPassword());

        Family family;
        if (requestDto.getInviteCode() != null && !requestDto.getInviteCode().isEmpty()) {
            family = familyRepository.findByInviteCode(requestDto.getInviteCode())
                    .orElseThrow(() -> new IllegalArgumentException("잘못된 초대 코드입니다."));
        } else {
            String newCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
            family = new Family(newCode);
            familyRepository.save(family);

            int count = Math.min(requestDto.getBabyCount(), requestDto.getBabyNames().size());
            for (int i = 0; i < count; i++) {
                Baby baby = new Baby(
                    requestDto.getBabyNames().get(i),
                    requestDto.getBabyGenders().get(i),
                    requestDto.getBabyBirthDate(),
                    family
                );
                babyRepository.save(baby);
            }
        }

        User user = new User(
                requestDto.getEmail(),
                encodedPassword,
                "LOCAL",
                requestDto.getName(),
                requestDto.getNickname(),
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

        if (user.getCodeCreatedAt() == null ||
            Duration.between(user.getCodeCreatedAt(), LocalDateTime.now()).getSeconds() > 180) {
            throw new IllegalArgumentException("인증 시간이 만료되었습니다. 다시 발송해 주세요.");
        }

        if (user.getVerificationCode() != null && user.getVerificationCode().equals(code)) {
            user.verifyEmail();
            user.setVerificationCode(null);
            return true;
        }
        return false;
    }

    @Transactional(readOnly = true)
    public String login(LoginRequestDto loginRequestDto) {
        User user = userRepository.findByEmail(loginRequestDto.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("가입되지 않은 이메일입니다."));

        if (!passwordEncoder.matches(loginRequestDto.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        if (!user.isEmailVerified()) {
            throw new IllegalArgumentException("이메일 인증이 완료되지 않았습니다.");
        }

        return jwtUtil.createToken(user.getEmail(), user.getRole());
    }

    // ==========================================
    // 마이페이지: 내 프로필 조회
    // ==========================================
    @Transactional(readOnly = true)
    public UserProfileResponseDto getProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        String inviteCode = null;
        List<UserProfileResponseDto.BabyDto> babyDtos = List.of();

        if (user.getFamily() != null) {
            inviteCode = user.getFamily().getInviteCode();
            babyDtos = babyRepository.findByFamily(user.getFamily()).stream()
                    .map(b -> new UserProfileResponseDto.BabyDto(b.getId(), b.getName(), b.getGender(), b.getBirthDate()))
                    .collect(Collectors.toList());
        }

        return new UserProfileResponseDto(
                user.getEmail(),
                user.getName(),
                user.getNickname(),
                user.getRole(),
                user.getPhoneNumber(),
                user.getAddress(),
                user.getProvider(),
                inviteCode,
                babyDtos
        );
    }

    // ==========================================
    // 마이페이지: 회원정보 수정
    // ==========================================
    @Transactional
    public void updateProfile(String email, UpdateProfileRequestDto dto) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.updateProfile(dto.getName(), dto.getNickname(), dto.getPhoneNumber(), dto.getAddress());
    }

    // ==========================================
    // 마이페이지: 비밀번호 변경
    // ==========================================
    @Transactional
    public void changePassword(String email, ChangePasswordRequestDto dto) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        if (!"LOCAL".equals(user.getProvider())) {
            throw new IllegalArgumentException("소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.");
        }

        if (!passwordEncoder.matches(dto.getCurrentPassword(), user.getPassword())) {
            throw new IllegalArgumentException("현재 비밀번호가 일치하지 않습니다.");
        }

        user.changePassword(passwordEncoder.encode(dto.getNewPassword()));
    }

    // ==========================================
    // 마이페이지: 가족 초대코드로 연결
    // ==========================================
    @Transactional
    public String joinFamily(String email, String inviteCode) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        Family family = familyRepository.findByInviteCode(inviteCode.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("유효하지 않은 초대 코드입니다."));

        user.joinFamily(family);
        return family.getInviteCode();
    }
}
