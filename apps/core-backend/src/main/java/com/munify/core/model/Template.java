package com.munify.core.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Represents a protocol-compliant document template for MUN proceedings.
 * Templates define the structure (preamble + operative clauses) that
 * delegates must follow when drafting official documents.
 */
@Entity
@Table(name = "templates")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Template {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Human-readable template name, e.g. "Position Paper", "Draft Resolution".
     */
    @Column(nullable = false, unique = true)
    private String name;

    /**
     * The type of MUN document this template produces.
     * Enforced via enum: POSITION_PAPER, RESOLUTION, DECLARATION, WORKING_PAPER.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentType documentType;

    /**
     * JSON/Markdown skeleton with placeholder markers that the AI
     * and collaborative editor will populate.
     * Example: "# {{country}} Position on {{topic}}\n\n## Context\n..."
     */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String structureBody;

    /**
     * Brief description of when and how to use this template.
     */
    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
