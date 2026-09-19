package com.chatbot.parenting;

import com.chatbot.parenting.domain.*;
import com.chatbot.parenting.dto.*;
import com.chatbot.parenting.repository.*;
import com.chatbot.parenting.service.*;
import com.chatbot.parenting.controller.DailyLogController;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DailyLogActivityTest {
    DailyLogRepository logs = mock(DailyLogRepository.class);
    UserRepository users = mock(UserRepository.class);
    FamilyAccessService access = mock(FamilyAccessService.class);
    Baby baby = mock(Baby.class);
    User user = mock(User.class);
    DailyLogService service = new DailyLogService(logs, access, users);
    ObjectMapper json = new ObjectMapper();

    @BeforeEach void setup() {
        when(users.findByEmail("fixture@example.test")).thenReturn(Optional.of(user));
        when(access.requireBaby("fixture@example.test", 1L)).thenReturn(baby);
        when(user.getNickname()).thenReturn("fixture"); when(baby.getId()).thenReturn(1L);
        when(baby.getBirthDate()).thenReturn(LocalDate.of(2026, 1, 1));
        when(logs.save(any())).thenAnswer(call -> call.getArgument(0));
    }
    DailyLogRequestDto request(String fields) throws Exception {
        return json.readValue("{\"recordTime\":\"2026-09-18T23:30:00\"," + fields + "}", DailyLogRequestDto.class);
    }
    @Test void foodWithUnknownAmountAndOvernightNapRoundTripAndClear() throws Exception {
        var dto = service.addLog("fixture@example.test", 1L, request("\"solidFoodName\":\" 채소죽 \",\"napEndTime\":\"2026-09-19T00:30:00\""));
        assertThat(dto.getSolidFoodName()).isEqualTo("채소죽");
        assertThat(dto.getSolidFoodAmount()).isNull();
        assertThat(dto.getNapEndTime()).isEqualTo("2026-09-19T00:30");
        var capture = org.mockito.ArgumentCaptor.forClass(DailyLog.class);
        verify(logs).save(capture.capture());
        when(logs.findById(5L)).thenReturn(Optional.of(capture.getValue()));
        var updated = service.updateLog("fixture@example.test", 5L, request("\"solidFoodName\":\"쌀미음\",\"solidFoodAmount\":75"));
        assertThat(updated.getSolidFoodAmount()).isEqualTo(75);
        assertThat(updated.getNapEndTime()).isNull();
    }
    @Test void rejectsInvalidActivitiesBeforePersistence() throws Exception {
        for (String fields : List.of("\"solidFoodAmount\":20", "\"solidFoodName\":\"죽\",\"solidFoodAmount\":-1",
                "\"solidFoodName\":\"죽\",\"solidFoodAmount\":1001", "\"napEndTime\":\"2026-09-18T23:30:00\"",
                "\"napEndTime\":\"2026-09-20T00:00:00\"", "\"napEndTime\":\"bad\"", "\"memo\":\"   \"",
                "\"formulaAmount\":-10", "\"diaperType\":\"BAD\"")) {
            var dto = request(fields);
            assertThatThrownBy(() -> service.addLog("fixture@example.test", 1L, dto)).isInstanceOf(IllegalArgumentException.class);
        }
        verify(logs, never()).save(any());
    }
    @Test void existingFeedingAndMemoStillWorkAndMissingActivitiesStayNull() throws Exception {
        var dto = service.addLog("fixture@example.test", 1L, request("\"formulaAmount\":120,\"breastfed\":true,\"diaperType\":\"WET\",\"memo\":\"fixture\""));
        assertThat(dto.getFormulaAmount()).isEqualTo(120);
        assertThat(dto.getSolidFoodName()).isNull(); assertThat(dto.getNapEndTime()).isNull();
    }
    @Test void aiSeparatesRecordedFactsAndUnknownAmountsFromMedicalAdvice() throws Exception {
        var dto = service.addLog("fixture@example.test", 1L, request("\"solidFoodName\":\"채소죽\",\"napEndTime\":\"2026-09-19T00:30:00\""));
        var input = DailyLogAiInput.from(baby, LocalDate.of(2026, 9, 18), List.of(dto));
        assertThat(input.prompt()).contains("채소죽", "섭취량 미기록", "60분", "적정량·적정 수면시간은 판단하지");
        assertThat(input.query()).doesNotContain("채소죽", "fixture");
    }
    @Test void csvIncludesNewFieldsAndProtectsSpreadsheetCells() throws Exception {
        var row = service.addLog("fixture@example.test", 1L, request("\"solidFoodName\":\"=1+1\",\"solidFoodAmount\":80,\"napEndTime\":\"2026-09-19T00:30:00\""));
        var read = mock(DailyLogService.class);
        var date = LocalDate.of(2026, 9, 18);
        when(read.getLogsByRange("fixture@example.test", 1L, date, date)).thenReturn(List.of(row));
        when(baby.getName()).thenReturn("fixture");
        var controller = new DailyLogController(read, mock(GeminiService.class), access);
        var response = new MockHttpServletResponse();
        controller.exportCsv(1L, date, date, "fixture@example.test", response);
        assertThat(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).contains("이유식량(g)", "낮잠종료", "'=1+1", "80", "2026-09-19T00:30");
    }
}
