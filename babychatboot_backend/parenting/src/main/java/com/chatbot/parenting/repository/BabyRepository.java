package com.chatbot.parenting.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.chatbot.parenting.domain.Baby;

public interface BabyRepository extends JpaRepository<Baby, Long> {
    
}
