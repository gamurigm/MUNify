package com.munify.core.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DocumentVersionResponse {
    private Long id;
    private Integer versionNumber;
    private String content;
    private String changeSummary;
    private String editedByUsername;
    private LocalDateTime createdAt;
}
