package com.iozycore.infrastructure.persistence.experience;

import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Repository
@Transactional
public class JpaExperienceRepositoryAdapter implements ExperienceRepository {

    private final ExperienceJpaRepository jpaRepository;

    public JpaExperienceRepositoryAdapter(ExperienceJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Experience save(Experience experience) {
        return toDomain(jpaRepository.save(toJpa(experience)));
    }

    @Override
    public Optional<Experience> findById(UUID id) {
        return jpaRepository.findById(id).map(JpaExperienceRepositoryAdapter::toDomain);
    }

    @Override
    public List<Experience> findByEntityId(UUID entityId) {
        return jpaRepository.findByEntityId(entityId).stream()
                .map(JpaExperienceRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteById(UUID id) {
        // deleteById de Spring Data est déjà silencieux sur un id absent -
        // c'est exactement le contrat idempotent documenté sur le port.
        jpaRepository.deleteById(id);
    }

    @Override
    public boolean existsByEntityId(UUID entityId) {
        return jpaRepository.existsByEntityId(entityId);
    }

    @Override
    public List<Experience> findAll() {
        return jpaRepository.findAll().stream()
                .map(JpaExperienceRepositoryAdapter::toDomain)
                .collect(Collectors.toList());
    }

    private static ExperienceJpaEntity toJpa(Experience experience) {
        return new ExperienceJpaEntity(
                experience.id(),
                experience.entityId(),
                experience.variantId().orElse(null),
                experience.ownerId(),
                experience.experienceType(),
                experience.occurredAt(),
                experience.rating().orElse(null),
                experience.comment()
        );
    }

    private static Experience toDomain(ExperienceJpaEntity jpaEntity) {
        return Experience.reconstitute(
                jpaEntity.getId(),
                jpaEntity.getEntityId(),
                jpaEntity.getVariantId(),
                jpaEntity.getOwnerId(),
                jpaEntity.getExperienceType(),
                jpaEntity.getOccurredAt(),
                jpaEntity.getRating(),
                jpaEntity.getComment()
        );
    }
}
