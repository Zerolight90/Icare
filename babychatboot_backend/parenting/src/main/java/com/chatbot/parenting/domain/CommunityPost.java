package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "community_posts")
public class CommunityPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String imageUrls;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User author;

    private int viewCount = 0;
    private int commentCount = 0;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public CommunityPost(String title, String content, String imageUrls, Board board, User author) {
        this.title = title;
        this.content = content;
        this.imageUrls = imageUrls;
        this.board = board;
        this.author = author;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void update(String title, String content, String imageUrls) {
        this.title = title;
        this.content = content;
        this.imageUrls = imageUrls;
        this.updatedAt = LocalDateTime.now();
    }

    public void incrementViewCount() { this.viewCount++; }
    public void incrementCommentCount() { this.commentCount++; }
    public void decrementCommentCount() { if (this.commentCount > 0) this.commentCount--; }
}
