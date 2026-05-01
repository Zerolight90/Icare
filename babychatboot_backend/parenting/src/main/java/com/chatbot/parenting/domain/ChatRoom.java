package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Getter
@NoArgsConstructor
public class ChatRoom {

    @Id
    private String id = UUID.randomUUID().toString(); // 자동생성으로 변경

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String title;
    
    private boolean isActive = true;

    private LocalDateTime createdAt = LocalDateTime.now();

    // ✅ 추가
    public ChatRoom(User user, String title) {
        this.user = user;
        this.title = title;
    }
}