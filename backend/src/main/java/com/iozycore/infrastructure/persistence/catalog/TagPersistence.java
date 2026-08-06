package com.iozycore.infrastructure.persistence.catalog;

import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@jakarta.persistence.Entity
@Table(name = "tag")
class TagJpaEntity {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String label;

    protected TagJpaEntity() {
    }

    TagJpaEntity(UUID id, String label) {
        this.id = id;
        this.label = label;
    }

    UUID getId() { return id; }
    String getLabel() { return label; }
}

interface TagJpaRepository extends JpaRepository<TagJpaEntity, UUID> {
    Optional<TagJpaEntity> findByLabel(String label);
}

@Repository
@Transactional
class JpaTagRepositoryAdapter implements TagRepository {

    private final TagJpaRepository jpaRepository;

    JpaTagRepositoryAdapter(TagJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Tag save(Tag tag) {
        TagJpaEntity saved = jpaRepository.save(new TagJpaEntity(tag.id(), tag.label()));
        return new Tag(saved.getId(), saved.getLabel());
    }

    @Override
    public Optional<Tag> findById(UUID id) {
        return jpaRepository.findById(id).map(e -> new Tag(e.getId(), e.getLabel()));
    }

    @Override
    public Optional<Tag> findByLabel(String label) {
        return jpaRepository.findByLabel(label).map(e -> new Tag(e.getId(), e.getLabel()));
    }

    @Override
    public List<Tag> findAll() {
        return jpaRepository.findAll().stream()
                .map(e -> new Tag(e.getId(), e.getLabel()))
                .collect(Collectors.toList());
    }
}
