package com.munify.core.dto;

import com.munify.core.model.DocumentStatus;
import com.munify.core.model.DocumentType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DocumentResponse {
    private Long id;
    private String title;
    private String topic;
    private String committee;
    private String country;
    private DocumentType documentType;
    private DocumentStatus status;
    private String content;
    private String latexSource;
    private Integer currentVersion;
    private String authorUsername;
    private Long authorId;
    private String templateName;
    private Long templateId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
