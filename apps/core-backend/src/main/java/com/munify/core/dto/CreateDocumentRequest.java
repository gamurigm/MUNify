package com.munify.core.dto;

import com.munify.core.model.DocumentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateDocumentRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotBlank(message = "Topic is required")
    private String topic;

    private String committee;

    private String country;

    @NotNull(message = "Document type is required")
    private DocumentType documentType;

    /** Optional initial content body. */
    private String content;

    /** Optional template ID to base the document on. */
    private Long templateId;
}
