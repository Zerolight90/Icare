package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "babies") // 테이블 이름도 babies로 깔끔하게!
public class Baby {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name; // 아기 이름

    @Column(nullable = false, length = 1)
    private String gender; // 'M', 'F', 'U'

    @Column(nullable = false)
    private LocalDate birthDate; // 생년월일

    private LocalDateTime createdAt = LocalDateTime.now(); // 프로필 생성일

    // ★ 핵심: User가 아니라 Family와 연결됩니다!
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_id", nullable = false)
    private Family family; 

    // 생성자
    public Baby(String name, String gender, LocalDate birthDate, Family family) {
        this.name = name;
        this.gender = gender;
        this.birthDate = birthDate;
        this.family = family;
    }
}