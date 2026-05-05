package com.chatbot.parenting.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class PostListResponseDto {
    private Long id;
    private String title;
    private String authorNickname;
    private int commentCount;
    private int viewCount;
    private String createdAt;
    private String boardName;
    private Long boardId;
}
