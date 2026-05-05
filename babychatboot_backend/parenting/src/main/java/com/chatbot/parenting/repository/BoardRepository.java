package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.Board;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BoardRepository extends JpaRepository<Board, Long> {
    List<Board> findByActiveOrderByDisplayOrderAsc(boolean active);
    List<Board> findByBoardTypeAndActiveOrderByDisplayOrderAsc(String boardType, boolean active);
}
