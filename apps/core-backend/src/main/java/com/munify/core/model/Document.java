package com.munify.core.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Core entity representing any official MUN document (position paper,
 * resolution, declaration, working paper). Linked to an author (User),
 * an optional template, and maintains a full history of versions.
 */
@Entity
@Table(name = "documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Short title, e.g. "Draft Resolution on Climate Action" */
    @Column(nullable = false)
    private String title;

    /** The MUN topic this document addresses. */
    @Column(nullable = false)
    private String topic;

    /** The committee context (e.g. "GA", "SC", "ECOSOC"). */
    private String committee;

    /** Country or delegation that authored this document. */
    private String country;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private DocumentStatus status = DocumentStatus.DRAFT;

    /** The current/latest body content (HTML for Tiptap editor). */
    @Column(columnDefinition = "TEXT")
    private String content;

    /** The LaTeX source code (canonical format for PDF generation). */
    @Column(columnDefinition = "TEXT")
    private String latexSource;

    /** Current semantic version number, auto-incremented on save. */
    @Builder.Default
    private Integer currentVersion = 1;

    /** The user who created this document. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    private User author;

    /** Optional template this document was instantiated from. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "template_id")
    private Template template;

    /** Full edit history for Git-like versioning. */
    @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("versionNumber DESC")
    @Builder.Default
    private List<DocumentVersion> versions = new ArrayList<>();

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
