package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.CommunityComment;
import com.chatbot.parenting.domain.CommunityPost;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CommunityCommentRepository extends JpaRepository<CommunityComment, Long> {
    List<CommunityComment> findByPostOrderByCreatedAtAsc(CommunityPost post);
}
