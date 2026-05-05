package com.chatbot.parenting.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class PostDetailResponseDto {
    private Long id;
    private String title;
    private String content;
    private String imageUrls;
    private String authorNickname;
    private String authorEmail;
    private int viewCount;
    private String createdAt;
    private String updatedAt;
    private String boardName;
    private Long boardId;
    private List<CommentDto> comments;

    @Getter
    @AllArgsConstructor
    public static class CommentDto {
        private Long id;
        private String content;
        private String authorNickname;
        private String authorEmail;
        private String createdAt;
    }
}
