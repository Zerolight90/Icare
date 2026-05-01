package com.chatbot.parenting.dto;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;

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
    // 아기 정보도 같이 받기 (V2 기획 반영)
    private String babyName;
    private String babyGender;
    private LocalDate babyBirthDate;
    private String inviteCode; // 배우자 초대 코드 (선택사항)
}