package com.chatbot.parenting.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.chatbot.parenting.domain.Family;
import java.util.Optional;

public interface FamilyRepository extends JpaRepository<Family, Long> {

    Optional<Family> findByInviteCode(String inviteCode);
    
}
