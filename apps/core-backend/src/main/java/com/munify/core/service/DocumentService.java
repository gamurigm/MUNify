package com.munify.core.service;

import com.munify.core.dto.*;
import com.munify.core.model.*;
import com.munify.core.repository.DocumentRepository;
import com.munify.core.repository.DocumentVersionRepository;
import com.munify.core.repository.TemplateRepository;
import com.munify.core.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class DocumentService {

    @Autowired
    private DocumentRepository documentRepository;

    @Autowired
    private DocumentVersionRepository versionRepository;

    @Autowired
    private TemplateRepository templateRepository;

    @Autowired
    private UserRepository userRepository;

    // ──────────────────────────── CREATE ────────────────────────────

    @Transactional
    public DocumentResponse createDocument(CreateDocumentRequest request, String username) {
        User author = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        Document document = Document.builder()
                .title(request.getTitle())
                .topic(request.getTopic())
                .committee(request.getCommittee())
                .country(request.getCountry())
                .documentType(request.getDocumentType())
                .status(DocumentStatus.DRAFT)
                .currentVersion(1)
                .author(author)
                .build();

        // If a template is specified, pre-fill the content from the template body
        if (request.getTemplateId() != null) {
            Template template = templateRepository.findById(request.getTemplateId())
                    .orElseThrow(() -> new RuntimeException("Template not found: " + request.getTemplateId()));
            document.setTemplate(template);
            document.setContent(request.getContent() != null ? request.getContent() : template.getStructureBody());
        } else {
            document.setContent(request.getContent() != null ? request.getContent() : "");
        }

        Document saved = documentRepository.save(document);

        // Create initial version snapshot (v1)
        DocumentVersion v1 = DocumentVersion.builder()
                .versionNumber(1)
                .content(saved.getContent())
                .changeSummary("Initial creation")
                .editedBy(author)
                .document(saved)
                .build();
        versionRepository.save(v1);

        return toResponse(saved);
    }

    // ──────────────────────────── READ ────────────────────────────

    public DocumentResponse getDocument(Long id) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found: " + id));
        return toResponse(document);
    }

    public List<DocumentResponse> getAllDocuments() {
        return documentRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<DocumentResponse> getDocumentsByAuthor(String username) {
        User author = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));
        return documentRepository.findByAuthorId(author.getId()).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<DocumentResponse> getDocumentsByCommittee(String committee) {
        return documentRepository.findByCommittee(committee).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<DocumentResponse> getDocumentsByStatus(DocumentStatus status) {
        return documentRepository.findByStatus(status).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ──────────────────────────── UPDATE (with versioning) ────────────────────────────

    @Transactional
    public DocumentResponse updateDocument(Long id, UpdateDocumentRequest request, String username) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found: " + id));

        User editor = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        // Increment version
        int newVersion = document.getCurrentVersion() + 1;

        // Create a version snapshot of the NEW content
        DocumentVersion version = DocumentVersion.builder()
                .versionNumber(newVersion)
                .content(request.getContent())
                .changeSummary(request.getChangeSummary() != null ? request.getChangeSummary() : "Edit v" + newVersion)
                .editedBy(editor)
                .document(document)
                .build();
        versionRepository.save(version);

        // Update the document's current state
        document.setContent(request.getContent());
        document.setCurrentVersion(newVersion);
        Document saved = documentRepository.save(document);

        return toResponse(saved);
    }

    // ──────────────────────────── STATUS TRANSITIONS ────────────────────────────

    @Transactional
    public DocumentResponse updateStatus(Long id, DocumentStatus newStatus) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found: " + id));
        document.setStatus(newStatus);
        return toResponse(documentRepository.save(document));
    }

    // ──────────────────────────── DELETE ────────────────────────────

    @Transactional
    public void deleteDocument(Long id) {
        if (!documentRepository.existsById(id)) {
            throw new RuntimeException("Document not found: " + id);
        }
        documentRepository.deleteById(id);
    }

    @Autowired
    private AiAgentClient aiAgentClient;

    // ──────────────────────────── AI GENERATION ────────────────────────────

    @Transactional
    public DocumentResponse createAndGenerateWithAi(CreateDocumentRequest request, String username) {
        // 1. Create the base document record
        DocumentResponse baseDoc = createDocument(request, username);
        
        // 2. Generate the AI content for this new document
        return generateDraftWithAi(baseDoc.getId(), username);
    }

    @Transactional
    public DocumentResponse generateDraftWithAi(Long id, String username) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found: " + id));

        User editor = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found: " + username));

        // Let the AI do its heavy lifting (Tavily -> LangGraph -> NIM -> Critic)
        AiGenerateResponse aiResponse = aiAgentClient.generateDraft(
                document.getTopic(),
                document.getCountry(),
                document.getCommittee(),
                document.getDocumentType().name()
        );

        int newVersion = document.getCurrentVersion() + 1;

        // Store LaTeX as canonical source, HTML for tiptap editing
        String latexContent = aiResponse.getDraft();
        String htmlContent = aiResponse.getDraftHtml() != null 
            ? aiResponse.getDraftHtml() 
            : latexContent; // fallback

        DocumentVersion version = DocumentVersion.builder()
                .versionNumber(newVersion)
                .content(htmlContent)
                .changeSummary("AI Generated Draft (LaTeX)")
                .editedBy(editor)
                .document(document)
                .build();
        versionRepository.save(version);

        document.setContent(htmlContent);
        document.setLatexSource(latexContent);
        document.setCurrentVersion(newVersion);
        Document saved = documentRepository.save(document);

        return toResponse(saved);
    }

    // ──────────────────────────── VERSION HISTORY ────────────────────────────

    public List<DocumentVersionResponse> getVersionHistory(Long documentId) {
        return versionRepository.findByDocumentIdOrderByVersionNumberDesc(documentId).stream()
                .map(this::toVersionResponse)
                .collect(Collectors.toList());
    }

    public DocumentVersionResponse getSpecificVersion(Long documentId, Integer versionNumber) {
        DocumentVersion version = versionRepository
                .findByDocumentIdAndVersionNumber(documentId, versionNumber)
                .orElseThrow(() -> new RuntimeException(
                        "Version " + versionNumber + " not found for document " + documentId));
        return toVersionResponse(version);
    }

    // ──────────────────────────── PDF EXPORT ────────────────────────────

    public byte[] exportPdf(Long id) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Document not found: " + id));

        String latex = document.getLatexSource();
        
        try {
            if (latex != null && !latex.isBlank()) {
                // If we have canonical LaTeX source, use it
                return aiAgentClient.compilePdf(latex);
            } else {
                // FALLBACK: Compile from the current HTML content (supports manual edits and blank docs)
                String html = document.getContent();
                if (html == null || html.isBlank()) {
                    html = "<p>Documento vacío.</p>";
                }
                return aiAgentClient.compilePdfFromHtml(
                        html,
                        document.getTitle(),
                        document.getTopic(),
                        document.getCountry(),
                        document.getCommittee()
                );
            }
        } catch (Exception ex) {
            throw new RuntimeException("PDF export failed: " + ex.getMessage(), ex);
        }
    }

    // ──────────────────────────── MAPPERS ────────────────────────────

    private DocumentResponse toResponse(Document doc) {
        return DocumentResponse.builder()
                .id(doc.getId())
                .title(doc.getTitle())
                .topic(doc.getTopic())
                .committee(doc.getCommittee())
                .country(doc.getCountry())
                .documentType(doc.getDocumentType())
                .status(doc.getStatus())
                .content(doc.getContent())
                .latexSource(doc.getLatexSource())
                .currentVersion(doc.getCurrentVersion())
                .authorUsername(doc.getAuthor().getUsername())
                .authorId(doc.getAuthor().getId())
                .templateName(doc.getTemplate() != null ? doc.getTemplate().getName() : null)
                .templateId(doc.getTemplate() != null ? doc.getTemplate().getId() : null)
                .createdAt(doc.getCreatedAt())
                .updatedAt(doc.getUpdatedAt())
                .build();
    }

    private DocumentVersionResponse toVersionResponse(DocumentVersion v) {
        return DocumentVersionResponse.builder()
                .id(v.getId())
                .versionNumber(v.getVersionNumber())
                .content(v.getContent())
                .changeSummary(v.getChangeSummary())
                .editedByUsername(v.getEditedBy() != null ? v.getEditedBy().getUsername() : null)
                .createdAt(v.getCreatedAt())
                .build();
    }
}
