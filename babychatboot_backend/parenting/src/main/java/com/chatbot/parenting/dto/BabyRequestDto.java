package com.chatbot.parenting.dto;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;

@Getter
@Setter
public class BabyRequestDto {
    private String name;
    private String gender;
    private LocalDate birthDate;
    private Double weight;
    private Double height;
    private String specialNotes;
}
