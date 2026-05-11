package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, String> {

    // 현재 로그인 유저의 채팅방만 조회
    @Query("SELECT r FROM ChatRoom r WHERE r.user.email = :email ORDER BY r.createdAt DESC")
    List<ChatRoom> findByUserEmailOrderByCreatedAtDesc(@Param("email") String email);

    // 기간 필터 검색 (어드민용)
    @Query("SELECT DISTINCT r FROM ChatRoom r JOIN FETCH r.user u " +
           "WHERE r.createdAt BETWEEN :start AND :end " +
           "ORDER BY r.createdAt DESC")
    List<ChatRoom> findAllWithDateRange(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT DISTINCT r FROM ChatRoom r JOIN FETCH r.user u " +
           "WHERE u.id = :userId AND r.createdAt BETWEEN :start AND :end " +
           "ORDER BY r.createdAt DESC")
    List<ChatRoom> findByUserIdExact(
            @Param("userId") Long userId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT DISTINCT r FROM ChatRoom r JOIN FETCH r.user u " +
           "WHERE LOWER(u.nickname) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "AND r.createdAt BETWEEN :start AND :end " +
           "ORDER BY r.createdAt DESC")
    List<ChatRoom> findByNickname(
            @Param("keyword") String keyword,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Query("SELECT DISTINCT r FROM ChatRoom r JOIN FETCH r.user u " +
           "WHERE u.family IS NOT NULL " +
           "AND EXISTS (SELECT b FROM Baby b WHERE b.family = u.family " +
           "    AND LOWER(b.name) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND r.createdAt BETWEEN :start AND :end " +
           "ORDER BY r.createdAt DESC")
    List<ChatRoom> findByBabyName(
            @Param("keyword") String keyword,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);
}
