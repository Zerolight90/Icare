package com.chatbot.parenting.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.time.LocalDate;
import java.util.List;

@Getter
@AllArgsConstructor
public class UserProfileResponseDto {
    private String email;
    private String name;
    private String nickname;
    private String role;
    private String phoneNumber;
    private String address;
    private String provider;
    private String inviteCode;
    private List<BabyDto> babies;

    @Getter
    @AllArgsConstructor
    public static class BabyDto {
        private Long id;
        private String name;
        private String gender;
        private LocalDate birthDate;
    }
}
