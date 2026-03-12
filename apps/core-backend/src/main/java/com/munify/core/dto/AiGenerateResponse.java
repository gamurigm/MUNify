package com.munify.core.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;

@Data
public class AiGenerateResponse {
    private String draft;          // LaTeX source
    
    @JsonProperty("draft_html")
    private String draftHtml;      // HTML for Tiptap editor
    
    @JsonProperty("strategy_guide")
    private String strategyGuide;
    
    private List<String> errors;
    
    @JsonProperty("research_data")
    private List<String> researchData;
}
