package com.munify.core.repository;

import com.munify.core.model.Template;
import com.munify.core.model.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateRepository extends JpaRepository<Template, Long> {

    Optional<Template> findByName(String name);

    List<Template> findByDocumentType(DocumentType documentType);
}
