package com.chatbot.parenting.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DailyLogResponseDto {
    private Long id;
    private String recordTime;    // ISO-8601 문자열
    private Integer formulaAmount;
    private Boolean breastfed;
    private String diaperType;
    private String memo;
    private String writerNickname;
}
