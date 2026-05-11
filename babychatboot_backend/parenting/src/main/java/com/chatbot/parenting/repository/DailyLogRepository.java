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

    // 세분화 검색: 기간 + 검색타입 + 기저귀타입 + 수유방법
    // diaperType: "" = 전체, "NONE"/"WET"/"DIRTY"/"BOTH" = 필터
    // breastfed:  "ALL" = 전체, "YES" = 모유, "NO" = 미수유
    // keyword: "" = 전체
    @Query("SELECT l FROM DailyLog l WHERE " +
           "l.recordTime BETWEEN :start AND :end " +
           "AND (:diaperType = '' OR l.diaperType = :diaperType) " +
           "AND (:breastfed = 'ALL' OR " +
           "     (:breastfed = 'YES' AND l.breastfed = TRUE) OR " +
           "     (:breastfed = 'NO'  AND (l.breastfed = FALSE OR l.breastfed IS NULL))) " +
           "AND (:keyword = '' OR (" +
           "     (:searchType = 'babyName'  AND LOWER(l.baby.name) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "     (:searchType = 'nickname'  AND LOWER(l.user.nickname) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "     (:searchType = 'memo'      AND l.memo IS NOT NULL AND LOWER(l.memo) LIKE LOWER(CONCAT('%', :keyword, '%'))))) " +
           "ORDER BY l.recordTime DESC")
    Page<DailyLog> searchAdvanced(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("diaperType") String diaperType,
            @Param("breastfed") String breastfed,
            @Param("keyword") String keyword,
            @Param("searchType") String searchType,
            Pageable pageable);
}
