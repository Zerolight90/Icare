package com.chatbot.parenting.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "boards")
public class Board {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 200)
    private String description;

    private Integer displayOrder;

    // "COMMUNITY" | "MEDICAL"
    @Column(nullable = false)
    private String boardType;

    private boolean active = true;

    public Board(String name, String description, Integer displayOrder, String boardType) {
        this.name = name;
        this.description = description;
        this.displayOrder = displayOrder;
        this.boardType = boardType;
    }

    public void update(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public void updateAll(String name, String description, Integer displayOrder, String boardType) {
        this.name = name;
        this.description = description;
        this.displayOrder = displayOrder;
        this.boardType = boardType;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}
