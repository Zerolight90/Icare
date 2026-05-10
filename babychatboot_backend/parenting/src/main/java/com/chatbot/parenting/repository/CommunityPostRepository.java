package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.Board;
import com.chatbot.parenting.domain.CommunityPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    // 일반 사용자용: 활성 게시글만 (status=1)
    Page<CommunityPost> findByBoardAndStatusOrderByCreatedAtDesc(Board board, int status, Pageable pageable);

    // 관리자용: 모든 게시글 (status 무관)
    Page<CommunityPost> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
