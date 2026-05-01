package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    
    // ★ Long이 아니라 String(UUID) 타입으로 방 번호를 받도록 수정!
    List<ChatMessage> findByChatRoom_IdOrderByIdAsc(String roomId);
    
    // ★ 삭제할 때도 String 타입으로!
    void deleteByChatRoom_Id(String roomId);
}