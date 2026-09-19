package com.chatbot.parenting;

import com.chatbot.parenting.controller.*;
import com.chatbot.parenting.domain.*;
import com.chatbot.parenting.dto.DailyLogRequestDto;
import com.chatbot.parenting.repository.*;
import com.chatbot.parenting.service.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class FamilyBoundaryTest {
    UserRepository users = mock(UserRepository.class);
    BabyRepository babies = mock(BabyRepository.class);
    DailyLogRepository logs = mock(DailyLogRepository.class);
    FamilyAccessService access = new FamilyAccessService(users, babies);
    DailyLogService service = new DailyLogService(logs, access, users);
    User user = mock(User.class);
    Baby baby = mock(Baby.class);
    DailyLog log = mock(DailyLog.class);
    LocalDate date = LocalDate.of(2026, 9, 8);

    @BeforeEach void fixtures() {
        Family mine = mock(Family.class); Family other = mock(Family.class);
        when(mine.getId()).thenReturn(1L); when(other.getId()).thenReturn(2L);
        when(user.getFamily()).thenReturn(mine); when(baby.getFamily()).thenReturn(other); when(baby.getId()).thenReturn(2L);
        when(users.findByEmail("parent@example.test")).thenReturn(Optional.of(user));
        when(babies.findById(2L)).thenReturn(Optional.of(baby));
        when(log.getBaby()).thenReturn(baby); when(logs.findById(3L)).thenReturn(Optional.of(log));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test void everyLogOperationRejectsOtherFamilyBeforeDataReadOrMutation() {
        assertThatThrownBy(() -> service.getLogs("parent@example.test", 2L, date)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.getLogsByRange("parent@example.test", 2L, date, date)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.addLog("parent@example.test", 2L, new DailyLogRequestDto())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.updateLog("parent@example.test", 3L, new DailyLogRequestDto())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.deleteLog("parent@example.test", 3L)).isInstanceOf(AccessDeniedException.class);
        verify(logs, never()).findByBabyAndRecordTimeBetweenOrderByRecordTimeAsc(any(), any(), any());
        verify(logs, never()).save(any()); verify(logs, never()).delete(any());
        verify(log, never()).update(any(), any(), any(), any(), any());
    }
    @Test void csvAndHealthRejectBeforeOutputOrAiCall() throws Exception {
        var ai = mock(GeminiService.class);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new DailyLogController(service, ai, access))
            .setControllerAdvice(new ApiExceptionHandler())
            .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("parent@example.test", null, List.of()));
        mvc.perform(get("/api/logs/2/export").param("from", date.toString()).param("to", date.toString()))
            .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Content-Disposition"));
        mvc.perform(post("/api/logs/2/health-check").param("date", date.toString())).andExpect(status().isForbidden());
        verifyNoInteractions(ai);
    }
    @Test void ownFamilyWorksAndMissingFamilyFailsClosed() {
        Family ownFamily = user.getFamily();
        when(baby.getFamily()).thenReturn(ownFamily);
        when(logs.findByBabyAndRecordTimeBetweenOrderByRecordTimeAsc(any(), any(), any())).thenReturn(List.of());
        assertThat(service.getLogs("parent@example.test", 2L, date)).isEmpty();
        verify(logs).findByBabyAndRecordTimeBetweenOrderByRecordTimeAsc(baby, date.atStartOfDay(), date.plusDays(1).atStartOfDay());
        when(user.getFamily()).thenReturn(null);
        assertThatThrownBy(() -> access.requireBaby("parent@example.test", 2L)).isInstanceOf(AccessDeniedException.class);
    }
    @Test void chatOwnershipIsCheckedBeforeRetrievalAndModel() {
        var rooms = mock(ChatRoomRepository.class); var messages = mock(ChatMessageRepository.class);
        var model = mock(org.springframework.ai.chat.client.ChatClient.class); var vector = mock(org.springframework.ai.vectorstore.VectorStore.class);
        var config = mock(ChatbotConfigRepository.class); var room = mock(ChatRoom.class);
        when(room.getUser()).thenReturn(user); when(user.getEmail()).thenReturn("owner@example.test"); when(rooms.findById("room")).thenReturn(Optional.of(room));
        var ai = new GeminiService(model, new KnowledgeSearchService(vector, new com.fasterxml.jackson.databind.ObjectMapper()), messages, rooms, users, config, new AiRequestGuard(4000, 1024, 5, new FakeRequestControl()), new ChatContextService(messages, mock(FamilyAccessService.class)));
        assertThatThrownBy(() -> ai.askToGemini("room", "question", "parent@example.test")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> ai.getChatHistoryByRoom("room", "parent@example.test")).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> ai.resetChatHistory("room", "parent@example.test")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(model, vector, messages, config);
    }
}
