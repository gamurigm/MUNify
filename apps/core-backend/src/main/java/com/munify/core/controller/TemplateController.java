package com.munify.core.controller;

import com.munify.core.dto.CreateTemplateRequest;
import com.munify.core.dto.TemplateResponse;
import com.munify.core.model.DocumentType;
import com.munify.core.service.TemplateService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {

    @Autowired
    private TemplateService templateService;

    @PostMapping
    public ResponseEntity<TemplateResponse> create(@Valid @RequestBody CreateTemplateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.createTemplate(request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TemplateResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(templateService.getTemplate(id));
    }

    @GetMapping
    public ResponseEntity<List<TemplateResponse>> getAll(
            @RequestParam(required = false) String type) {
        if (type != null) {
            return ResponseEntity.ok(
                    templateService.getTemplatesByType(DocumentType.valueOf(type.toUpperCase())));
        }
        return ResponseEntity.ok(templateService.getAllTemplates());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        templateService.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }
}
