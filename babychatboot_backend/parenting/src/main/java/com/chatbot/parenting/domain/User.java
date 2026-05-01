package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 1. 로그인 정보 & 보안
    @Column(nullable = false, unique = true)
    private String email; // 로그인 아이디 겸용 (unique=true로 중복 자동 방지!)

    private String password; // (Spring Security의 BCryptPasswordEncoder로 암호화되어 저장될 예정)

    @Column(nullable = false)
    private String provider; // 가입 방식: "LOCAL", "KAKAO", "NAVER", "GOOGLE"

    @Column(nullable = false)
    private boolean emailVerified = false; // 이메일 인증 완료 여부

    // 2. 개인 정보
    @Column(nullable = false)
    private String name; // 본명

    @Column(nullable = false) // ★ 추가: DB 에러 방지를 위해 nickname 필드 추가
    private String nickname;

    @Column(nullable = false)
    private String role; // 성별/역할: "MOM"(엄마) 또는 "DAD"(아빠)

    private LocalDate birthDate; // 부모의 생년월일

    private String phoneNumber; // 전화번호

    private String address; // 주소

    private String verificationCode; // 이메일 인증 시 사용할 6자리 랜덤 코드 (가입 시 생성되어 이메일로 발송)

    private LocalDateTime codeCreatedAt; // 인증번호 생성 시간 저장

    // 3. 가족 연결
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_id")
    private Family family;

    // 생성자 (가입 시 필요한 필수 정보들)
    public User(String email, String password, String provider, String name, String nickname, String role, LocalDate birthDate, String phoneNumber, String address) {
        this.email = email;
        this.password = password; // 서비스 단에서 암호화 후 넘겨줌
        this.provider = provider;
        this.name = name;
        this.nickname = nickname;
        this.role = role;
        this.birthDate = birthDate;
        this.phoneNumber = phoneNumber;
        this.address = address;
    }

    // 이메일 인증 성공 시 상태 변경 메서드
    public void verifyEmail() {
        this.emailVerified = true;
    }

    // 가족 그룹 연결 메서드
    public void joinFamily(Family family) {
        this.family = family;
    }

    // 인증번호 설정 메서드
    public void setVerificationCode(String code) {
        this.verificationCode = code;
        this.codeCreatedAt = LocalDateTime.now(); // 번호 세팅할 때 현재 시간도 저장
    }
    
}