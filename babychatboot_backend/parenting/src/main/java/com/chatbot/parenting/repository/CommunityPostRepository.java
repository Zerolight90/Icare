package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.Board;
import com.chatbot.parenting.domain.CommunityPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {
    Page<CommunityPost> findByBoardOrderByCreatedAtDesc(Board board, Pageable pageable);
}
