package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "babies")
public class Baby {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 1)
    private String gender;

    @Column(nullable = false)
    private LocalDate birthDate;

    private Double weight;

    private Double height;

    @Column(length = 500)
    private String specialNotes;

    private LocalDateTime createdAt = LocalDateTime.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_id", nullable = false)
    private Family family;

    public Baby(String name, String gender, LocalDate birthDate, Family family) {
        this.name = name;
        this.gender = gender;
        this.birthDate = birthDate;
        this.family = family;
    }

    public void update(String name, String gender, LocalDate birthDate,
                       Double weight, Double height, String specialNotes) {
        this.name = name;
        this.gender = gender;
        this.birthDate = birthDate;
        this.weight = weight;
        this.height = height;
        this.specialNotes = specialNotes;
    }
}
