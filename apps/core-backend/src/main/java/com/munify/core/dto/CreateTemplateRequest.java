package com.munify.core.dto;

import com.munify.core.model.DocumentType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateTemplateRequest {

    @NotBlank(message = "Template name is required")
    private String name;

    @NotNull(message = "Document type is required")
    private DocumentType documentType;

    @NotBlank(message = "Structure body is required")
    private String structureBody;

    private String description;
}
