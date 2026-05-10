package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.Notice;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NoticeRepository extends JpaRepository<Notice, Long> {
    List<Notice> findByActiveTrueOrderByPinnedDescCreatedAtDesc();
    List<Notice> findAllByOrderByPinnedDescCreatedAtDesc();
}
