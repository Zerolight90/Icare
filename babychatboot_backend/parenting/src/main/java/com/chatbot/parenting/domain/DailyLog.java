package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "daily_logs")
public class DailyLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime recordTime; // 날짜/시간

    private Integer formulaAmount; // 분유량 (ml), null = 미기록

    private Boolean breastfed; // 수유 여부

    // "NONE"(없음), "WET"(소변), "DIRTY"(대변), "BOTH"(소변+대변)
    private String diaperType;

    @Column(length = 500)
    private String memo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "baby_id", nullable = false)
    private Baby baby;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private LocalDateTime createdAt;

    public DailyLog(LocalDateTime recordTime, Integer formulaAmount, Boolean breastfed,
                    String diaperType, String memo, Baby baby, User user) {
        this.recordTime = recordTime;
        this.formulaAmount = formulaAmount;
        this.breastfed = breastfed;
        this.diaperType = diaperType;
        this.memo = memo;
        this.baby = baby;
        this.user = user;
        this.createdAt = LocalDateTime.now();
    }

    public void update(LocalDateTime recordTime, Integer formulaAmount, Boolean breastfed,
                       String diaperType, String memo) {
        this.recordTime = recordTime;
        this.formulaAmount = formulaAmount;
        this.breastfed = breastfed;
        this.diaperType = diaperType;
        this.memo = memo;
    }
}
