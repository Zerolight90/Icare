package com.chatbot.parenting;

import com.chatbot.parenting.domain.*;
import com.chatbot.parenting.repository.*;
import com.chatbot.parenting.service.*;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AiRequestBoundaryTest {
    @Test void boundsContextAndOutputAndFailureDoesNotSaveMessages() {
        var client = mock(ChatClient.class); var vector = mock(VectorStore.class);
        var messages = mock(ChatMessageRepository.class); var rooms = mock(ChatRoomRepository.class);
        var users = mock(UserRepository.class); var configs = mock(ChatbotConfigRepository.class);
        var user = mock(User.class); var room = mock(ChatRoom.class);
        when(user.getEmail()).thenReturn("parent@example.test"); when(room.getUser()).thenReturn(user);
        when(rooms.findById("room")).thenReturn(Optional.of(room));
        when(room.getContextVersion()).thenReturn(1);
        when(room.getContextFamilyId()).thenReturn(null);
        when(room.getContextBabyId()).thenReturn(null);
        when(configs.findByConfigKey("system_prompt")).thenReturn(Optional.of(new ChatbotConfig("system_prompt", "당신은 소아과 전문의입니다.", "old fixture")));
        var ai = new GeminiService(client, new KnowledgeSearchService(vector, new com.fasterxml.jackson.databind.ObjectMapper()), messages, rooms, users, configs, new AiRequestGuard(4000, 1024, 5, new FakeRequestControl()), new ChatContextService(messages, mock(FamilyAccessService.class)));
        assertThatThrownBy(() -> ai.askToGemini("room", "x".repeat(4001), "parent@example.test")).hasMessageContaining("400");
        verifyNoInteractions(client, vector, messages);

        when(vector.similaritySearch(any(org.springframework.ai.vectorstore.SearchRequest.class))).thenReturn(List.of(new Document("x".repeat(20000), java.util.Map.of("icare_managed", true, "icare_active", true, "source_url", "https://example.test/guidance", "source", "test", "icare_version", "00000000-0000-0000-0000-000000000001"))));
        var request = mock(ChatClient.ChatClientRequestSpec.class, RETURNS_SELF);
        var call = mock(ChatClient.CallResponseSpec.class);
        when(client.prompt()).thenReturn(request); when(request.call()).thenReturn(call);
        when(call.content()).thenThrow(new IllegalStateException("test provider unavailable"));
        assertThatThrownBy(() -> ai.askToGemini("room", "question", "parent@example.test")).isInstanceOf(IllegalStateException.class);
        verify(messages, never()).save(any(ChatMessage.class));
        var previousAnswer = mock(ChatMessageRepository.RecentMessage.class);
        var previousQuestion = mock(ChatMessageRepository.RecentMessage.class);
        when(previousAnswer.getRole()).thenReturn(ChatMessage.RoleType.ASSISTANT);
        when(previousAnswer.getContent()).thenReturn("previous answer");
        when(previousQuestion.getRole()).thenReturn(ChatMessage.RoleType.USER);
        when(previousQuestion.getContent()).thenReturn("previous question");
        when(messages.findRecentForOwner(any(), eq("parent@example.test"), anyList(), any()))
                .thenReturn(List.of(previousAnswer, previousQuestion));
        doReturn("answer").when(call).content();
        assertThat(ai.askToGemini("room", "question", "parent@example.test")).isEqualTo("answer");
        verify(request).messages(argThat((List<org.springframework.ai.chat.messages.Message> list) ->
                list.size() == 4 && list.get(1) instanceof org.springframework.ai.chat.messages.UserMessage
                && list.get(1).getText().equals("previous question")
                && list.get(2) instanceof org.springframework.ai.chat.messages.AssistantMessage
                && list.get(2).getText().equals("previous answer") && list.get(3).getText().equals("question")));
        verify(request, times(2)).messages(argThat((List<org.springframework.ai.chat.messages.Message> list) -> list.stream().mapToInt(m -> m.getText().length()).sum() < 10000));
        verify(request, times(2)).messages(argThat((List<org.springframework.ai.chat.messages.Message> list) ->
                list.get(0).getText().contains("의료인이 아닙니다") && !list.get(0).getText().contains("당신은 소아과 전문의입니다")));
        verify(request, times(2)).options(argThat((GoogleGenAiChatOptions options) -> options.getMaxOutputTokens() == 1024));
        verify(messages, times(2)).save(any(ChatMessage.class));
        verify(messages).save(argThat(message -> message.getRole() == ChatMessage.RoleType.ASSISTANT
                && message.getRetrievalSources().contains("https://example.test/guidance")));
    }
}
