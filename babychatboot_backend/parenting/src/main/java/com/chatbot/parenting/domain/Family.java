package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "families")
public class Family {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 6)
    private String inviteCode; // 6자리 영문/숫자 초대 코드

    private LocalDateTime createdAt; // 가족 그룹 생성일

    public Family(String inviteCode) {
        this.inviteCode = inviteCode;
        this.createdAt = LocalDateTime.now();
    }
}