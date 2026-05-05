package com.chatbot.parenting.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class DailyLogRequestDto {
    private String recordTime;   // ISO-8601 (e.g. "2025-05-05T14:30:00")
    private Integer formulaAmount; // 분유량(ml), null 가능
    private Boolean breastfed;
    private String diaperType;   // "NONE" | "WET" | "DIRTY" | "BOTH"
    private String memo;
}
