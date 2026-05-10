package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    private String password;

    @Column(nullable = false)
    private String provider;

    @Column(nullable = false)
    private boolean emailVerified = false;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String nickname;

    @Column(nullable = false)
    private String role; // "MOM" | "DAD"

    private LocalDate birthDate;
    private String phoneNumber;
    private String address;
    private String verificationCode;
    private LocalDateTime codeCreatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_id")
    private Family family;

    public User(String email, String password, String provider, String name, String nickname,
                String role, LocalDate birthDate, String phoneNumber, String address) {
        this.email = email;
        this.password = password;
        this.provider = provider;
        this.name = name;
        this.nickname = nickname;
        this.role = role;
        this.birthDate = birthDate;
        this.phoneNumber = phoneNumber;
        this.address = address;
    }

    public void verifyEmail() { this.emailVerified = true; }

    public void joinFamily(Family family) { this.family = family; }

    public void setVerificationCode(String code) {
        this.verificationCode = code;
        this.codeCreatedAt = LocalDateTime.now();
    }

    public void updateProfile(String name, String nickname, String phoneNumber, String address) {
        this.name = name;
        this.nickname = nickname;
        this.phoneNumber = phoneNumber;
        this.address = address;
    }

    public void changePassword(String encodedPassword) { this.password = encodedPassword; }
}
