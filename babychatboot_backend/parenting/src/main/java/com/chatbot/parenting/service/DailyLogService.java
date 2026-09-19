package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.DailyLog;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.DailyLogRequestDto;
import com.chatbot.parenting.dto.DailyLogResponseDto;

import com.chatbot.parenting.repository.DailyLogRepository;
import com.chatbot.parenting.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DailyLogService {

    private final DailyLogRepository dailyLogRepository;
    private final FamilyAccessService familyAccess;
    private final UserRepository userRepository;

    // 특정 날짜 로그 조회
    @Transactional(readOnly = true)
    public List<DailyLogResponseDto> getLogs(String email, Long babyId, LocalDate date) {
        Baby baby = familyAccess.requireBaby(email, babyId);
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = date.plusDays(1).atStartOfDay();
        return dailyLogRepository
                .findByBabyAndRecordTimeBetweenOrderByRecordTimeAsc(baby, start, end)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    // 기간 조회 (CSV 다운로드용)
    @Transactional(readOnly = true)
    public List<DailyLogResponseDto> getLogsByRange(String email, Long babyId, LocalDate from, LocalDate to) {
        Baby baby = familyAccess.requireBaby(email, babyId);
        if (from == null || to == null || to.isBefore(from) || java.time.temporal.ChronoUnit.DAYS.between(from, to) > 366) throw new IllegalArgumentException("조회 기간은 최대 1년입니다.");
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        return dailyLogRepository
                .findByBabyAndRecordTimeBetweenOrderByRecordTimeAsc(baby, start, end)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    // 로그 추가
    @Transactional
    public DailyLogResponseDto addLog(String email, Long babyId, DailyLogRequestDto dto) {
        User user = findUser(email);
        Baby baby = familyAccess.requireBaby(email, babyId);
        LocalDateTime recordTime = validate(dto);
        DailyLog log = new DailyLog(
                recordTime,
                dto.getFormulaAmount(),
                dto.getBreastfed(),
                dto.getDiaperType() != null ? dto.getDiaperType() : "NONE",
                dto.getMemo(),
                baby, user
        );
        log.updateActivities(foodName(dto), dto.getSolidFoodAmount(), napEnd(dto));
        return toDto(dailyLogRepository.save(log));
    }

    // 로그 수정
    @Transactional
    public DailyLogResponseDto updateLog(String email, Long logId, DailyLogRequestDto dto) {
        DailyLog log = dailyLogRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("기록을 찾을 수 없습니다."));
        familyAccess.requireBaby(email, log.getBaby().getId());
        LocalDateTime recordTime = validate(dto);
        log.update(
                recordTime,
                dto.getFormulaAmount(),
                dto.getBreastfed(),
                dto.getDiaperType() != null ? dto.getDiaperType() : "NONE",
                dto.getMemo()
        );
        log.updateActivities(foodName(dto), dto.getSolidFoodAmount(), napEnd(dto));
        return toDto(log);
    }

    // 로그 삭제
    @Transactional
    public void deleteLog(String email, Long logId) {
        DailyLog log = dailyLogRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("기록을 찾을 수 없습니다."));
        familyAccess.requireBaby(email, log.getBaby().getId());
        dailyLogRepository.delete(log);
    }

    private static String foodName(DailyLogRequestDto dto) {
        return dto.getSolidFoodName() == null || dto.getSolidFoodName().isBlank() ? null : dto.getSolidFoodName().trim();
    }
    private static LocalDateTime parseTime(String value) {
        try { return LocalDateTime.parse(value); }
        catch (RuntimeException e) { throw new IllegalArgumentException("날짜와 시간을 확인해 주세요."); }
    }
    private static LocalDateTime napEnd(DailyLogRequestDto dto) {
        return dto.getNapEndTime() == null || dto.getNapEndTime().isBlank() ? null : parseTime(dto.getNapEndTime());
    }
    private static LocalDateTime validate(DailyLogRequestDto dto) {
        LocalDateTime start = parseTime(dto.getRecordTime());
        if (dto.getFormulaAmount() != null && (dto.getFormulaAmount() < 0 || dto.getFormulaAmount() > 2000))
            throw new IllegalArgumentException("분유량은 0~2000ml로 입력해 주세요.");
        String food = foodName(dto);
        if (food != null && food.length() > 100) throw new IllegalArgumentException("이유식 이름은 100자 이내로 입력해 주세요.");
        if (dto.getSolidFoodAmount() != null && (food == null || dto.getSolidFoodAmount() < 1 || dto.getSolidFoodAmount() > 1000))
            throw new IllegalArgumentException("이유식 이름과 섭취량(1~1000g)을 확인해 주세요.");
        LocalDateTime end = napEnd(dto);
        if (end != null && (!end.isAfter(start) || end.isAfter(start.plusHours(24))))
            throw new IllegalArgumentException("낮잠 종료는 시작 이후 24시간 이내여야 합니다.");
        if (dto.getMemo() != null && dto.getMemo().length() > 500) throw new IllegalArgumentException("메모는 500자 이내로 입력해 주세요.");
        if (dto.getDiaperType() != null && !java.util.Set.of("NONE", "WET", "DIRTY", "BOTH").contains(dto.getDiaperType()))
            throw new IllegalArgumentException("기저귀 종류를 확인해 주세요.");
        if (dto.getFormulaAmount() == null && !Boolean.TRUE.equals(dto.getBreastfed()) && food == null && end == null
                && (dto.getDiaperType() == null || "NONE".equals(dto.getDiaperType()))
                && (dto.getMemo() == null || dto.getMemo().isBlank()))
            throw new IllegalArgumentException("한 가지 이상의 일과나 메모를 입력해 주세요.");
        return start;
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    private DailyLogResponseDto toDto(DailyLog log) {
        return new DailyLogResponseDto(
                log.getId(),
                log.getRecordTime().toString(),
                log.getFormulaAmount(),
                log.getBreastfed(),
                log.getDiaperType(),
                log.getMemo(),
                log.getUser().getNickname(),
                log.getSolidFoodName(), log.getSolidFoodAmount(),
                log.getNapEndTime() == null ? null : log.getNapEndTime().toString()
        );
    }
}
