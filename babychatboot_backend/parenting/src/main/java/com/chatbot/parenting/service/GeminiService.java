package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.ChatMessage;
import com.chatbot.parenting.domain.ChatRoom;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.repository.ChatMessageRepository;
import com.chatbot.parenting.repository.ChatRoomRepository;
import com.chatbot.parenting.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.vectorstore.QuestionAnswerAdvisor;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeminiService {

    private final ChatClient chatClient;
    private final VectorStore vectorStore;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final UserRepository userRepository;

    private static final String SYSTEM_PROMPT =
        "당신은 'iCare' 플랫폼의 10년 차 소아과 의사 닥터 의비스 입니다.\n" +
        "[매우 엄격한 답변 규칙]\n" +
        "사용자의 질문이 '육아, 아이 건강, 수유, 수면, 아기 발달'과 직접적인 관련이 없다면, " +
        "어떤 위로나 부연 설명도 하지 말고 오직 아래 문장만 출력하세요.\n" +
        "\"해당 질문은 답변할 수 없습니다. 아이의 건강이나 육아와 관련된 내용을 질문해 주세요.\"\n\n" +
        "[상담 모의 훈련 예시]\n" +
        "사용자: 부천 매운 닭발집 추천 좀 해줘\n" +
        "간호사: 해당 질문은 답변할 수 없습니다. 아이의 건강이나 육아와 관련된 내용을 질문해 주세요.\n\n" +
        "사용자: 우리 유리 분유량이 너무 적은 것 같아\n" +
        "간호사: (다정하고 전문적인 육아 상담 진행)\n\n" +
        "[RAG 지식 활용]\n" +
        "아래 제공된 참고 문서(육아 지식 베이스)를 활용하여 정확하고 구체적인 답변을 제공하세요. " +
        "문서에 없는 내용은 일반 의학 지식을 바탕으로 답하되, 항상 전문의 상담을 권유하세요.";

    // ==========================================
    // 채팅방(Room) 관리
    // ==========================================

    @Transactional
    public ChatRoom createNewRoom(String title) {
        User testUser = userRepository.findByEmail("test@test.com").orElse(null);

        if (testUser == null) {
            testUser = new User(
                "test@test.com",
                "dummy_password",
                "LOCAL",
                "테스트아빠",
                "test_nickname",
                "DAD",
                LocalDate.of(1990, 1, 1),
                "010-1234-5678",
                "테스트 주소"
            );
            testUser = userRepository.save(testUser);
        }

        ChatRoom newRoom = new ChatRoom(testUser, title);
        return chatRoomRepository.save(newRoom);
    }

    public List<ChatRoom> getAllRooms() {
        return chatRoomRepository.findAll();
    }

    // ==========================================
    // 메시지 관리 및 RAG 기반 AI 응답
    // ==========================================

    public List<ChatMessage> getChatHistoryByRoom(String roomId) {
        return chatMessageRepository.findByChatRoom_IdOrderByIdAsc(roomId);
    }

    @Transactional
    public void resetChatHistory(String roomId) {
        chatMessageRepository.deleteByChatRoom_Id(roomId);
    }

    public String healthCheck(String prompt) {
        try {
            return chatClient.prompt()
                .system("당신은 소아과 전문의입니다. 아이의 하루 수유·배변 기록을 보고 친절하고 전문적으로 건강 상태를 평가해 주세요. 마크다운 형식으로 가독성 있게 작성하세요.")
                .user(prompt)
                .call()
                .content();
        } catch (Exception e) {
            log.error("[HealthCheck] 오류", e);
            return "AI 건강 문진 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
        }
    }

    @Transactional
    public String askToGemini(String roomId, String prompt) {
        ChatRoom room = chatRoomRepository.findById(roomId)
            .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 방입니다."));

        chatMessageRepository.save(new ChatMessage(room, ChatMessage.RoleType.USER, prompt));

        try {
            // RAG: pgvector 유사도 검색 → 관련 육아 지식 주입 → Gemini 응답
            String response = chatClient.prompt()
                .system(SYSTEM_PROMPT)
                .user(prompt)
                .advisors(QuestionAnswerAdvisor.builder(vectorStore).build())
                .call()
                .content();

            chatMessageRepository.save(new ChatMessage(room, ChatMessage.RoleType.ASSISTANT, response));
            return response;

        } catch (Exception e) {
            log.error("[RAG Chat] 응답 생성 중 오류 발생", e);
            String errorMsg = e.getMessage() != null && e.getMessage().contains("429")
                ? "앗! 너무 질문을 많이 해서 간호사 선생님이 조금 지치셨어요. 잠시 후에 다시 질문해 주세요!"
                : "앗! 간호사 선생님과 통신 에러가 발생했어요.";
            return errorMsg;
        }
    }
}
