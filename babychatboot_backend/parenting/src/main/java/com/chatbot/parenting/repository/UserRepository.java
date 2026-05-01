package com.chatbot.parenting.repository;

import com.chatbot.parenting.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    // 이메일로 유저 찾기 (Optional로 감싸서 NullPointException 방지)
    Optional<User> findByEmail(String email);
    
    // 이메일 중복 확인용 (가입 시 필요)
    boolean existsByEmail(String email);
}