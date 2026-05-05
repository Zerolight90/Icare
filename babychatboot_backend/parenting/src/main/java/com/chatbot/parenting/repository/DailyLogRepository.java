package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.DailyLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface DailyLogRepository extends JpaRepository<DailyLog, Long> {

    List<DailyLog> findByBabyAndRecordTimeBetweenOrderByRecordTimeAsc(
            Baby baby, LocalDateTime start, LocalDateTime end);
}
