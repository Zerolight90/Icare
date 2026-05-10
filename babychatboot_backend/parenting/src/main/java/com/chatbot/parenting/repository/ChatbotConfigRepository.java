package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.ChatbotConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ChatbotConfigRepository extends JpaRepository<ChatbotConfig, Long> {
    Optional<ChatbotConfig> findByConfigKey(String configKey);
}
