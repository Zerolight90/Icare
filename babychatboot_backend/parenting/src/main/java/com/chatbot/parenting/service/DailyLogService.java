package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.DailyLog;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.DailyLogRequestDto;
import com.chatbot.parenting.dto.DailyLogResponseDto;
import com.chatbot.parenting.repository.BabyRepository;
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
        LocalDateTime recordTime = LocalDateTime.parse(dto.getRecordTime());
        DailyLog log = new DailyLog(
                recordTime,
                dto.getFormulaAmount(),
                dto.getBreastfed(),
                dto.getDiaperType() != null ? dto.getDiaperType() : "NONE",
                dto.getMemo(),
                baby, user
        );
        return toDto(dailyLogRepository.save(log));
    }

    // 로그 수정
    @Transactional
    public DailyLogResponseDto updateLog(String email, Long logId, DailyLogRequestDto dto) {
        DailyLog log = dailyLogRepository.findById(logId)
                .orElseThrow(() -> new IllegalArgumentException("기록을 찾을 수 없습니다."));
        familyAccess.requireBaby(email, log.getBaby().getId());
        log.update(
                LocalDateTime.parse(dto.getRecordTime()),
                dto.getFormulaAmount(),
                dto.getBreastfed(),
                dto.getDiaperType() != null ? dto.getDiaperType() : "NONE",
                dto.getMemo()
        );
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
                log.getUser().getNickname()
        );
    }
}
