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
        var ai = new GeminiService(client, vector, messages, rooms, users, configs, new AiRequestGuard(4000, 1024, 5));
        assertThatThrownBy(() -> ai.askToGemini("room", "x".repeat(4001), "parent@example.test")).hasMessageContaining("400");
        verifyNoInteractions(client, vector, messages);

        when(vector.similaritySearch(any(org.springframework.ai.vectorstore.SearchRequest.class))).thenReturn(List.of(new Document("x".repeat(20000))));
        var request = mock(ChatClient.ChatClientRequestSpec.class, RETURNS_SELF);
        var call = mock(ChatClient.CallResponseSpec.class);
        when(client.prompt()).thenReturn(request); when(request.call()).thenReturn(call);
        when(call.content()).thenThrow(new IllegalStateException("test provider unavailable"));
        assertThatThrownBy(() -> ai.askToGemini("room", "question", "parent@example.test")).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(messages);
        doReturn("answer").when(call).content();
        assertThat(ai.askToGemini("room", "question", "parent@example.test")).isEqualTo("answer");
        verify(request, times(2)).messages(argThat((org.springframework.ai.chat.messages.Message message) -> message.getText().length() < 8100), any(org.springframework.ai.chat.messages.UserMessage.class));
        verify(request, times(2)).options(argThat((GoogleGenAiChatOptions options) -> options.getMaxOutputTokens() == 1024));
        verify(messages, times(2)).save(any(ChatMessage.class));
    }
}
