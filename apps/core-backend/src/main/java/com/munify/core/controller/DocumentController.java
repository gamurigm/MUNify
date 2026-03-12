package com.munify.core.controller;

import com.munify.core.dto.*;
import com.munify.core.model.DocumentStatus;
import com.munify.core.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    @Autowired
    private DocumentService documentService;

    // ──────────────────────────── CREATE ────────────────────────────

    @PostMapping
    public ResponseEntity<DocumentResponse> create(
            @Valid @RequestBody CreateDocumentRequest request,
            Authentication authentication) {
        DocumentResponse response = documentService.createDocument(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // ──────────────────────────── READ ────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.getDocument(id));
    }

    @GetMapping
    public ResponseEntity<List<DocumentResponse>> getAll(
            @RequestParam(required = false) String committee,
            @RequestParam(required = false) String status) {
        if (committee != null) {
            return ResponseEntity.ok(documentService.getDocumentsByCommittee(committee));
        }
        if (status != null) {
            return ResponseEntity.ok(documentService.getDocumentsByStatus(DocumentStatus.valueOf(status.toUpperCase())));
        }
        return ResponseEntity.ok(documentService.getAllDocuments());
    }

    @GetMapping("/my")
    public ResponseEntity<List<DocumentResponse>> getMyDocuments(Authentication authentication) {
        return ResponseEntity.ok(documentService.getDocumentsByAuthor(authentication.getName()));
    }

    // ──────────────────────────── AI GENERATION ────────────────────────────

    @PostMapping("/generate-full")
    public ResponseEntity<DocumentResponse> createAndGenerateWithAi(
            @Valid @RequestBody CreateDocumentRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(documentService.createAndGenerateWithAi(request, authentication.getName()));
    }

    @PostMapping("/{id}/generate")
    public ResponseEntity<DocumentResponse> generateDraftWithAi(
            @PathVariable Long id,
            Authentication authentication) {
        return ResponseEntity.ok(documentService.generateDraftWithAi(id, authentication.getName()));
    }

    // ──────────────────────────── UPDATE ────────────────────────────

    @PutMapping("/{id}")
    public ResponseEntity<DocumentResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateDocumentRequest request,
            Authentication authentication) {
        return ResponseEntity.ok(documentService.updateDocument(id, request, authentication.getName()));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<DocumentResponse> updateStatus(
            @PathVariable Long id,
            @RequestParam DocumentStatus status) {
        return ResponseEntity.ok(documentService.updateStatus(id, status));
    }

    // ──────────────────────────── DELETE ────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        documentService.deleteDocument(id);
        return ResponseEntity.noContent().build();
    }

    // ──────────────────────────── VERSION HISTORY ────────────────────────────

    @GetMapping("/{id}/versions")
    public ResponseEntity<List<DocumentVersionResponse>> getVersionHistory(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.getVersionHistory(id));
    }

    @GetMapping("/{id}/versions/{versionNumber}")
    public ResponseEntity<DocumentVersionResponse> getSpecificVersion(
            @PathVariable Long id,
            @PathVariable Integer versionNumber) {
        return ResponseEntity.ok(documentService.getSpecificVersion(id, versionNumber));
    }

    // ──────────────────────────── PDF EXPORT ────────────────────────────

    @GetMapping("/{id}/export-pdf")
    public ResponseEntity<byte[]> exportPdf(@PathVariable Long id) {
        try {
            byte[] pdf = documentService.exportPdf(id);
            return ResponseEntity.ok()
                    .header("Content-Type", "application/pdf")
                    .header("Content-Disposition", "attachment; filename=MUNify_Document_" + id + ".pdf")
                    .body(pdf);
        } catch (Exception e) {
            e.printStackTrace(); // Log the error for debugging
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
