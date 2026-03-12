package com.munify.core.service;

import com.munify.core.dto.AiGenerateRequest;
import com.munify.core.dto.AiGenerateResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
public class AiAgentClient {

    private final RestClient restClient;

    public AiAgentClient(@Value("${ai.agent.url:http://localhost:8000}") String aiAgentUrl) {
        // Use a longer timeout (120s) for AI Agent workflows
        org.springframework.http.client.SimpleClientHttpRequestFactory dynamicFactory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        dynamicFactory.setReadTimeout(120000); // ms
        dynamicFactory.setConnectTimeout(60000); // ms

        this.restClient = RestClient.builder()
                .baseUrl(aiAgentUrl)
                .requestFactory(dynamicFactory)
                .build();
    }

    public AiGenerateResponse generateDraft(String topic, String country, String committee, String documentType) {
        AiGenerateRequest request = AiGenerateRequest.builder()
                .topic(topic)
                .country(country)
                .committee(committee)
                .documentType(documentType)
                .build();

        try {
            return restClient.post()
                    .uri("/api/v1/generate")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AiGenerateResponse.class);
        } catch (RestClientResponseException ex) {
            throw new RuntimeException("Error communicating with AI Agent Service: " + ex.getResponseBodyAsString(), ex);
        }
    }

    public byte[] compilePdf(String latex) {
        try {
            return restClient.post()
                    .uri("/api/v1/compile-pdf")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(java.util.Map.of("latex", latex))
                    .retrieve()
                    .body(byte[].class);
        } catch (RestClientResponseException ex) {
            throw new RuntimeException("PDF compilation failed: " + ex.getResponseBodyAsString(), ex);
        }
    }

    public byte[] compilePdfFromHtml(String html, String title, String topic, String country, String committee) {
        try {
            return restClient.post()
                    .uri("/api/v1/compile-pdf-from-html")
                    .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                    .body(java.util.Map.of(
                            "html", html,
                            "title", title,
                            "topic", topic,
                            "country", country,
                            "committee", committee
                    ))
                    .retrieve()
                    .body(byte[].class);
        } catch (RestClientResponseException ex) {
            throw new RuntimeException("HTML to PDF compilation failed: " + ex.getResponseBodyAsString(), ex);
        }
    }
}
