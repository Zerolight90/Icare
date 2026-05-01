package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "chat_messages")
@Getter
@NoArgsConstructor // JPA 필수 기본 생성자
public class ChatMessage {

    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ★ 드디어 봉인 해제! 메시지는 반드시 특정 채팅방(ChatRoom)에 속해야 합니다.
    @JsonIgnore // 직렬화할 때 이 필드는 무시 (순환참조 방지)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private ChatRoom chatRoom;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING) // DB에 'USER', 'ASSISTANT' 글자로 예쁘게 저장
    private RoleType role; 

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content; 

    private int tokenCount = 0;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public enum RoleType {
        USER, ASSISTANT, SYSTEM
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // 💡 저장할 때 쓰기 편하도록 만드는 생성자 (ChatRoom도 같이 넣어줌!)
    public ChatMessage(ChatRoom chatRoom, RoleType role, String content) {
        this.chatRoom = chatRoom;
        this.role = role;
        this.content = content;
    }
}