package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "records")
public class Record {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String recordType; // 종류: "FEEDING"(수유), "DIAPER"(기저귀), "SLEEP"(수면)

    private Integer amount; // 분유량(ml) (기저귀나 수면일 경우 null 이거나 다른 값으로 활용)

    private String memo; // "응가가 황금색이에요!" 같은 특이사항 메모

    private LocalDateTime recordTime; // 실제로 먹은/싼 시간

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "baby_id")
    private Baby baby; // 이 기록의 주인공 (유리)

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user; // 이 기록을 작성한 사람 (엄마 or 아빠)

    // 생성자
    public Record(String recordType, Integer amount, String memo, LocalDateTime recordTime, Baby baby, User user) {
        this.recordType = recordType;
        this.amount = amount;
        this.memo = memo;
        this.recordTime = recordTime;
        this.baby = baby;
        this.user = user;
    }
}