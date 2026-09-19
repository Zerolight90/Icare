package com.chatbot.parenting;

import com.chatbot.parenting.domain.*;
import com.chatbot.parenting.repository.ChatMessageRepository;
import com.chatbot.parenting.service.*;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChatContextTest {
    final ChatMessageRepository messages = mock(ChatMessageRepository.class);
    final FamilyAccessService access = mock(FamilyAccessService.class);
    final ChatContextService context = new ChatContextService(messages, access);

    private User user() {
        var user = new User("parent@example.test", "synthetic", "LOCAL", "test", "test", "MOM", null, null, null);
        var family = new Family("TEST01"); ReflectionTestUtils.setField(family, "id", 1L); user.joinFamily(family);
        return user;
    }
    private ChatMessageRepository.RecentMessage row(ChatMessage.RoleType role, String text) {
        return new ChatMessageRepository.RecentMessage() {
            public ChatMessage.RoleType getRole() { return role; }
            public String getContent() { return text; }
        };
    }
    @Test void recentTurnsStayInOrderAndExcludeOrphanAndSystemMessages() {
        var room = new ChatRoom(user(), "test");
        when(messages.findRecentForOwner(any(), any(), any(), any())).thenReturn(List.of(
            row(ChatMessage.RoleType.USER, "unanswered"), row(ChatMessage.RoleType.ASSISTANT, "answer2"),
            row(ChatMessage.RoleType.USER, "question2"), row(ChatMessage.RoleType.SYSTEM, "never promote to system"),
            row(ChatMessage.RoleType.ASSISTANT, "answer1"), row(ChatMessage.RoleType.USER, "question1")));
        var result = context.recent(room, user().getEmail());
        assertThat(result).extracting(Message::getText).containsExactly("question1", "answer1", "question2", "answer2");
        assertThat(result).extracting(Message::getMessageType).containsExactly(MessageType.USER, MessageType.ASSISTANT, MessageType.USER, MessageType.ASSISTANT);
        verify(messages).findRecentForOwner(eq(room.getId()), eq("parent@example.test"),
            eq(List.of(ChatMessage.RoleType.USER, ChatMessage.RoleType.ASSISTANT)), argThat(page -> page.getPageSize() == 12));
    }
    @Test void historyUsesWholeRecentTurnsUnderSixThousandCharacters() {
        var room = new ChatRoom(user(), "test");
        when(messages.findRecentForOwner(any(), any(), any(), any())).thenReturn(List.of(
            row(ChatMessage.RoleType.ASSISTANT, "a".repeat(1800)), row(ChatMessage.RoleType.USER, "q".repeat(1800)),
            row(ChatMessage.RoleType.ASSISTANT, "b".repeat(1800)), row(ChatMessage.RoleType.USER, "p".repeat(1800))));
        assertThat(context.recent(room, "parent@example.test")).hasSize(2);
        when(messages.findRecentForOwner(any(), any(), any(), any())).thenReturn(List.of(
            row(ChatMessage.RoleType.ASSISTANT, "a".repeat(2001)), row(ChatMessage.RoleType.USER, "q")));
        assertThat(context.recent(room, "parent@example.test")).isEmpty();
    }
    @Test void generalChatNeverChoosesAnUnrequestedBabyAndSelectedBabyIsRechecked() {
        User user = user();
        var general = context.newRoom(user, "general", null);
        assertThat(context.profile(general, user.getEmail())).contains("선택된 아이 프로필이 없습니다");
        verifyNoInteractions(access);
        var baby = new Baby("selected", "U", LocalDate.of(2026, 1, 1), user.getFamily());
        baby.update("selected", "U", baby.getBirthDate(), null, null, "parent note");
        when(access.requireBaby(user.getEmail(), 2L)).thenReturn(baby);
        var scoped = context.newRoom(user, "selected", 2L);
        assertThat(context.profile(scoped, user.getEmail())).contains("selected", "2026-01-01", "parent note", "알 수 없음");
        verify(access, times(2)).requireBaby(user.getEmail(), 2L);
        when(access.requireBaby(user.getEmail(), 2L)).thenThrow(new AccessDeniedException("deleted or another family"));
        assertThatThrownBy(() -> context.profile(scoped, user.getEmail())).isInstanceOf(AccessDeniedException.class);
    }
    @Test void otherOwnerChangedFamilyAndLegacyScopeCannotFeedHistoryToAi() {
        var user = user(); var room = new ChatRoom(user, "test");
        assertThatThrownBy(() -> context.recent(room, "other@example.test")).isInstanceOf(AccessDeniedException.class);
        var newFamily = new Family("TEST02"); ReflectionTestUtils.setField(newFamily, "id", 2L); user.joinFamily(newFamily);
        assertThatThrownBy(() -> context.recent(room, user.getEmail())).isInstanceOf(AccessDeniedException.class);
        ReflectionTestUtils.setField(room, "contextVersion", 0);
        assertThatThrownBy(() -> context.profile(room, user.getEmail())).hasMessageContaining("409");
        verifyNoInteractions(messages, access);
    }
    @Test void permitStaysBusyUntilTheMessageTransactionCompletes() {
        var guard = new AiRequestGuard(4000, 1024, 5, new FakeRequestControl());
        TransactionSynchronizationManager.initSynchronization();
        try {
            guard.acquire("parent", "question").close();
            assertThatThrownBy(() -> guard.acquire("parent", "second")).hasMessageContaining("429");
            var callbacks = TransactionSynchronizationManager.getSynchronizations();
            TransactionSynchronizationManager.clearSynchronization();
            callbacks.forEach(callback -> callback.afterCompletion(0));
            try (var permit = guard.acquire("parent", "second")) { }
        } finally { if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization(); }
    }
}
