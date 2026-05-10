package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.DailyLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;
import java.util.List;

public interface DailyLogRepository extends JpaRepository<DailyLog, Long> {

    List<DailyLog> findByBabyAndRecordTimeBetweenOrderByRecordTimeAsc(
            Baby baby, LocalDateTime start, LocalDateTime end);

    Page<DailyLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT l FROM DailyLog l WHERE " +
           "LOWER(l.baby.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(l.user.nickname) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(l.memo) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "ORDER BY l.createdAt DESC")
    Page<DailyLog> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
}
