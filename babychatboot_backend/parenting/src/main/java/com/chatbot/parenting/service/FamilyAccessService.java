package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.repository.BabyRepository;
import com.chatbot.parenting.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FamilyAccessService {
    private final UserRepository users;
    private final BabyRepository babies;

    @Transactional(readOnly = true)
    public Baby requireBaby(String email, Long babyId) {
        User user = users.findByEmail(email).orElseThrow(FamilyAccessService::denied);
        Baby baby = babies.findById(babyId).orElseThrow(FamilyAccessService::denied);
        if (user.getFamily() == null || baby.getFamily() == null || user.getFamily().getId() == null
                || !user.getFamily().getId().equals(baby.getFamily().getId())) throw denied();
        return baby;
    }

    private static AccessDeniedException denied() { return new AccessDeniedException("해당 가족 데이터에 접근할 수 없습니다."); }
}
