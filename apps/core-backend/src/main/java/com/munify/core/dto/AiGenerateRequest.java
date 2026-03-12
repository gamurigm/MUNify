package com.munify.core.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AiGenerateRequest {
    private String topic;
    private String country;
    private String committee;
    private String documentType;
}
