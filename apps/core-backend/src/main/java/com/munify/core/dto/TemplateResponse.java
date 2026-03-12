package com.munify.core.dto;

import com.munify.core.model.DocumentType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TemplateResponse {
    private Long id;
    private String name;
    private DocumentType documentType;
    private String structureBody;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
