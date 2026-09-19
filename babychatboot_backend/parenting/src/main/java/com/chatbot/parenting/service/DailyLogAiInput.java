package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.dto.DailyLogResponseDto;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Build the model input from an already authorized baby's dated records. */
public record DailyLogAiInput(String prompt, String query, int ageMonths) {
    public static DailyLogAiInput from(Baby baby, LocalDate date, List<DailyLogResponseDto> logs) {
        if (date == null || date.isAfter(LocalDate.now(ZoneId.of("Asia/Seoul")))
                || baby.getBirthDate() == null || date.isBefore(baby.getBirthDate()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "아이 생년월일과 분석 날짜를 확인해 주세요.");
        int age = Math.toIntExact(Period.between(baby.getBirthDate(), date).toTotalMonths());
        long formulaRecords = logs.stream().filter(l -> l.getFormulaAmount() != null).count();
        long formula = logs.stream().filter(l -> l.getFormulaAmount() != null).mapToLong(DailyLogResponseDto::getFormulaAmount).sum();
        long breast = logs.stream().filter(l -> Boolean.TRUE.equals(l.getBreastfed())).count();
        long wet = logs.stream().filter(l -> "WET".equals(l.getDiaperType()) || "BOTH".equals(l.getDiaperType())).count();
        long dirty = logs.stream().filter(l -> "DIRTY".equals(l.getDiaperType()) || "BOTH".equals(l.getDiaperType())).count();
        var prompt = new StringBuilder("선택 날짜: ").append(date).append(". 그 날짜 당시 만 ").append(age).append("개월.\n")
                .append("아래 값은 부모가 입력한 기록 일부입니다. 하루 전체 섭취량·횟수를 보장하지 않습니다. 미기록은 0회나 정상이라는 뜻이 아닙니다.\n")
                .append("기록된 분유량: ").append(formulaRecords == 0 ? "미기록" : formula + "ml (" + formulaRecords + "건)").append('\n')
                .append("기록된 모유 수유: ").append(count(breast)).append('\n')
                .append("기록된 소변 기저귀: ").append(count(wet)).append('\n')
                .append("기록된 대변 기저귀: ").append(count(dirty)).append('\n');
        // Current profile measurements have no measurement date; do not treat them as historic observations.
        prompt.append("체중·키 변화나 성장 평가는 이 자료로 할 수 없습니다. 수면·이유식 섭취량도 이 기록 항목에 없습니다.\n");
        prompt.append("부모가 입력한 현재 특이사항(당시 상태와 다를 수 있음): ").append(limit(baby.getSpecialNotes(), 400)).append('\n');
        var notes = new StringBuilder();
        for (var log : logs) {
            if (log.getMemo() != null && !log.getMemo().isBlank() && notes.length() < 1800)
                notes.append(limit(log.getMemo(), Math.min(300, 1800 - notes.length()))).append('\n');
        }
        prompt.append("선택 날짜의 부모 메모(최대 1800자, 일부 생략 가능):\n").append(notes)
                .append("\n부모 기록 요약, 참고자료에 따른 일반 안내, 추가로 확인할 정보를 구분해 작성하세요. ")
                .append("이 숫자만으로 수유·배변이 충분하다거나 부족하다고 판정하지 마세요. ")
                .append("분석은 기록 항목인 수유·배변과 관련 진료 필요 징후로 한정하세요. 발달 단계·수면·예방접종 안내를 덧붙이지 마세요. ")
                .append("위에 제공된 날짜 당시의 월령을 사용하고 이미 제공된 생년월일을 다시 요구하지 마세요.");
        // Public knowledge embeddings do not need names, email, free-text notes or family identifiers.
        String query = "영아 " + age + "개월 수유 모유 분유 영양 기저귀 배변 관찰 진료가 필요한 증상";
        return new DailyLogAiInput(prompt.toString(), query, age);
    }
    private static String count(long n) { return n == 0 ? "해당 항목 미기록" : n + "건"; }
    private static String limit(String text, int max) { return text == null || text.isBlank() ? "미기록" : text.substring(0, Math.min(text.length(), max)); }
}
