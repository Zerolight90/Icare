package com.chatbot.parenting.config;

import com.chatbot.parenting.domain.Board;
import com.chatbot.parenting.repository.BoardRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final BoardRepository boardRepository;

    @Override
    public void run(ApplicationArguments args) {
        if (boardRepository.count() == 0) {
            boardRepository.saveAll(List.of(
                new Board("병원추천",   "소아과·산부인과 등 병원 정보를 나눠요",        1, "COMMUNITY"),
                new Board("자유게시판", "육아에 관한 모든 이야기를 자유롭게 나눠요",    2, "COMMUNITY"),
                new Board("육아정보",   "유용한 육아 정보와 팁을 공유해요",             3, "COMMUNITY"),
                new Board("고민",       "육아하면서 생기는 고민을 함께 해결해요",       4, "COMMUNITY"),
                new Board("의학 질문",  "소아과 전문의에게 건강 상담을 받아보세요",     5, "MEDICAL")
            ));
        }
    }
}
