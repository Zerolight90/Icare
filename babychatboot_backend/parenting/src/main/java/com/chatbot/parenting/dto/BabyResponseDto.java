package com.chatbot.parenting.dto;

import com.chatbot.parenting.domain.Baby;
import lombok.Getter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
public class BabyResponseDto {
    private final Long id;
    private final String name;
    private final String gender;
    private final LocalDate birthDate;
    private final Double weight;
    private final Double height;
    private final String specialNotes;
    private final LocalDateTime createdAt;

    public BabyResponseDto(Baby baby) {
        this.id = baby.getId();
        this.name = baby.getName();
        this.gender = baby.getGender();
        this.birthDate = baby.getBirthDate();
        this.weight = baby.getWeight();
        this.height = baby.getHeight();
        this.specialNotes = baby.getSpecialNotes();
        this.createdAt = baby.getCreatedAt();
    }
}
