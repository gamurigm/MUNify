package com.munify.core.repository;

import com.munify.core.model.Document;
import com.munify.core.model.DocumentStatus;
import com.munify.core.model.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {

    List<Document> findByAuthorId(Long authorId);

    List<Document> findByCommittee(String committee);

    List<Document> findByDocumentType(DocumentType documentType);

    List<Document> findByStatus(DocumentStatus status);

    List<Document> findByCountry(String country);

    List<Document> findByCommitteeAndStatus(String committee, DocumentStatus status);
}
