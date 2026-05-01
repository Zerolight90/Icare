package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "categories")
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name; // 예: "수유량 상담"

    private String icon; // 예: "🍼"

    @Column(name = "display_order")
    private Integer displayOrder; // 정렬 순서

    public Category(String name, String icon, Integer displayOrder) {
        this.name = name;
        this.icon = icon;
        this.displayOrder = displayOrder;
    }
}