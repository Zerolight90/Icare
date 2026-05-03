package com.chatbot.parenting.dto;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
public class SignupRequestDto {
    private String email;
    private String password;
    private String name;
    private String nickname; // DB 에러 방지 위해 추가
    private String role; // "MOM" or "DAD"
    private LocalDate birthDate;
    private String phoneNumber;
    private String address;
    // 아기 정보 (단태아/쌍둥이/세쌍둥이 지원)
    private int babyCount = 1;          // 1: 단태아, 2: 쌍둥이, 3: 세쌍둥이
    private List<String> babyNames;     // 아기 이름 목록
    private List<String> babyGenders;   // 아기 성별 목록 (M/F/U)
    private LocalDate babyBirthDate;    // 생년월일 (같은 날 출생)
    private String inviteCode;          // 배우자 초대 코드 (선택사항)
}