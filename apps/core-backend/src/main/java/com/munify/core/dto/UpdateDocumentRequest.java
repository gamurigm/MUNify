package com.munify.core.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateDocumentRequest {

    @NotBlank(message = "Content is required")
    private String content;

    /** Optional summary of what changed in this version. */
    private String changeSummary;
}
