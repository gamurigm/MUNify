package com.munify.core.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * An immutable snapshot of a Document at a specific point in time.
 * Provides Git-like history: every save creates a new version,
 * retaining the previous content and an optional change summary.
 */
@Entity
@Table(name = "document_versions",
        uniqueConstraints = @UniqueConstraint(
                columnNames = {"document_id", "versionNumber"}
        ))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Sequential version number within a document (1, 2, 3...). */
    @Column(nullable = false)
    private Integer versionNumber;

    /** Full content snapshot at this version. */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    /** Human-readable summary of what changed, e.g. "Added clause 5b". */
    @Column(columnDefinition = "TEXT")
    private String changeSummary;

    /** Who made this edit. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "edited_by")
    private User editedBy;

    /** Parent document. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private Document document;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
