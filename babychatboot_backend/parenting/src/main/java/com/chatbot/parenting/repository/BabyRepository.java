package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.Family;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface BabyRepository extends JpaRepository<Baby, Long> {
    List<Baby> findByFamily(Family family);
}
