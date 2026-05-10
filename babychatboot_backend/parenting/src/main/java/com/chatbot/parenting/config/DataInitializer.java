package com.chatbot.parenting.config;

import com.chatbot.parenting.domain.Admin;
import com.chatbot.parenting.domain.Board;
import com.chatbot.parenting.domain.ChatbotConfig;
import com.chatbot.parenting.repository.AdminRepository;
import com.chatbot.parenting.repository.BoardRepository;
import com.chatbot.parenting.repository.ChatbotConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final BoardRepository boardRepository;
    private final AdminRepository adminRepository;
    private final ChatbotConfigRepository chatbotConfigRepository;
    private final PasswordEncoder passwordEncoder;

    private static final String SYSTEM_PROMPT_DEFAULT =
        "당신은 'iCare' 플랫폼의 10년 차 소아과 의사 닥터 의비스 입니다.\n" +
        "[매우 엄격한 답변 규칙]\n" +
        "사용자의 질문이 '육아, 아이 건강, 수유, 수면, 아기 발달'과 직접적인 관련이 없다면, " +
        "어떤 위로나 부연 설명도 하지 말고 오직 아래 문장만 출력하세요.\n" +
        "\"해당 질문은 답변할 수 없습니다. 아이의 건강이나 육아와 관련된 내용을 질문해 주세요.\"\n\n" +
        "[RAG 지식 활용]\n" +
        "아래 제공된 참고 문서(육아 지식 베이스)를 활용하여 정확하고 구체적인 답변을 제공하세요. " +
        "문서에 없는 내용은 일반 의학 지식을 바탕으로 답하되, 항상 전문의 상담을 권유하세요.";

    @Override
    public void run(ApplicationArguments args) {
        initBoards();
        initAdminAccount();
        initChatbotConfig();
    }

    private void initBoards() {
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

    private void initAdminAccount() {
        if (!adminRepository.existsByUsername("admin")) {
            Admin admin = new Admin("admin", passwordEncoder.encode("admin1234!"), "최고관리자");
            adminRepository.save(admin);
        }
    }

    private void initChatbotConfig() {
        if (chatbotConfigRepository.count() == 0) {
            chatbotConfigRepository.saveAll(List.of(
                new ChatbotConfig("system_prompt", SYSTEM_PROMPT_DEFAULT, "챗봇 시스템 프롬프트 (AI 역할 및 규칙 정의)"),
                new ChatbotConfig("bot_name", "닥터 의비스", "챗봇 표시 이름"),
                new ChatbotConfig("rag_top_k", "5", "RAG 검색 시 가져올 유사 문서 수"),
                new ChatbotConfig("welcome_message", "안녕하세요! 저는 iCare의 AI 육아 상담사입니다. 아이의 건강과 육아에 관한 무엇이든 물어보세요!", "챗봇 첫 인사말"),
                new ChatbotConfig("off_topic_response", "해당 질문은 답변할 수 없습니다. 아이의 건강이나 육아와 관련된 내용을 질문해 주세요.", "관련 없는 질문 거절 메시지"),
                new ChatbotConfig("rag_chunk_size", "512", "RAG 문서 청킹 크기 (토큰 단위, 권장: 256~1024)"),
                new ChatbotConfig("rag_chunk_overlap", "64", "청크 간 겹침 크기 (토큰 단위, 권장: chunk_size의 10~20%)")
            ));
        }
    }
}
