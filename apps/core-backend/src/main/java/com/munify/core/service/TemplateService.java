package com.munify.core.service;

import com.munify.core.dto.CreateTemplateRequest;
import com.munify.core.dto.TemplateResponse;
import com.munify.core.model.DocumentType;
import com.munify.core.model.Template;
import com.munify.core.repository.TemplateRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class TemplateService {

    @Autowired
    private TemplateRepository templateRepository;

    @Transactional
    public TemplateResponse createTemplate(CreateTemplateRequest request) {
        if (templateRepository.findByName(request.getName()).isPresent()) {
            throw new RuntimeException("A template with name '" + request.getName() + "' already exists.");
        }

        Template template = Template.builder()
                .name(request.getName())
                .documentType(request.getDocumentType())
                .structureBody(request.getStructureBody())
                .description(request.getDescription())
                .build();

        return toResponse(templateRepository.save(template));
    }

    public TemplateResponse getTemplate(Long id) {
        Template template = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found: " + id));
        return toResponse(template);
    }

    public List<TemplateResponse> getAllTemplates() {
        return templateRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<TemplateResponse> getTemplatesByType(DocumentType type) {
        return templateRepository.findByDocumentType(type).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteTemplate(Long id) {
        if (!templateRepository.existsById(id)) {
            throw new RuntimeException("Template not found: " + id);
        }
        templateRepository.deleteById(id);
    }

    private TemplateResponse toResponse(Template t) {
        return TemplateResponse.builder()
                .id(t.getId())
                .name(t.getName())
                .documentType(t.getDocumentType())
                .structureBody(t.getStructureBody())
                .description(t.getDescription())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }
}
