package com.chatbot.parenting.controller;

import com.chatbot.parenting.domain.Baby;
import com.chatbot.parenting.domain.Family;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.BabyRequestDto;
import com.chatbot.parenting.dto.BabyResponseDto;
import com.chatbot.parenting.repository.BabyRepository;
import com.chatbot.parenting.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/babies")
@RequiredArgsConstructor
public class BabyController {

    private final BabyRepository babyRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getBabies(@AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        Family family = user.getFamily();
        if (family == null) return ResponseEntity.ok(List.of());

        List<BabyResponseDto> result = babyRepository.findByFamily(family)
                .stream().map(BabyResponseDto::new).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> createBaby(
            @RequestBody BabyRequestDto dto,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        Family family = user.getFamily();
        if (family == null) return ResponseEntity.badRequest().body("가족 그룹이 없습니다. 회원가입을 완료해주세요.");

        Baby baby = new Baby(dto.getName(), dto.getGender(), dto.getBirthDate(), family);
        baby.update(dto.getName(), dto.getGender(), dto.getBirthDate(),
                dto.getWeight(), dto.getHeight(), dto.getSpecialNotes());
        return ResponseEntity.ok(new BabyResponseDto(babyRepository.save(baby)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateBaby(
            @PathVariable Long id,
            @RequestBody BabyRequestDto dto,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        Baby baby = babyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("아이 정보를 찾을 수 없습니다."));

        if (!baby.getFamily().getId().equals(user.getFamily().getId()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("권한이 없습니다.");

        baby.update(dto.getName(), dto.getGender(), dto.getBirthDate(),
                dto.getWeight(), dto.getHeight(), dto.getSpecialNotes());
        return ResponseEntity.ok(new BabyResponseDto(babyRepository.save(baby)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBaby(
            @PathVariable Long id,
            @AuthenticationPrincipal Object principal) {
        String email = extractEmail(principal);
        if (email == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        Baby baby = babyRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("아이 정보를 찾을 수 없습니다."));

        if (!baby.getFamily().getId().equals(user.getFamily().getId()))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("권한이 없습니다.");

        babyRepository.delete(baby);
        return ResponseEntity.ok().build();
    }

    private String extractEmail(Object principal) {
        if (principal instanceof org.springframework.security.core.userdetails.UserDetails ud)
            return ud.getUsername();
        if (principal instanceof String s) return s;
        return null;
    }
}
