package com.chatbot.parenting.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateProfileRequestDto {
    private String name;
    private String nickname;
    private String phoneNumber;
    private String address;
}
