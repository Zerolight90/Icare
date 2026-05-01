package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    // 순서대로 가져오기 위해 오더링 추가
    List<Category> findAllByOrderByDisplayOrderAsc();
}