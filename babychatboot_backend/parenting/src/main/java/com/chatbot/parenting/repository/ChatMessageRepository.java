package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    interface RecentMessage {
        ChatMessage.RoleType getRole();
        String getContent();
    }

    // Bound both number of rows and fetched TEXT size; owner check is also part of the query.
    @org.springframework.data.jpa.repository.Query("select m.role as role, substring(m.content, 1, 2001) as content "
            + "from ChatMessage m where m.chatRoom.id = :roomId and m.chatRoom.user.email = :email "
            + "and m.role in :roles order by m.id desc")
    List<RecentMessage> findRecentForOwner(@org.springframework.data.repository.query.Param("roomId") String roomId,
            @org.springframework.data.repository.query.Param("email") String email,
            @org.springframework.data.repository.query.Param("roles") List<ChatMessage.RoleType> roles, org.springframework.data.domain.Pageable page);
    
    // ★ Long이 아니라 String(UUID) 타입으로 방 번호를 받도록 수정!
    List<ChatMessage> findByChatRoom_IdOrderByIdAsc(String roomId);
    
    // ★ 삭제할 때도 String 타입으로!
    void deleteByChatRoom_Id(String roomId);

    long countByChatRoom_Id(String roomId);
}
