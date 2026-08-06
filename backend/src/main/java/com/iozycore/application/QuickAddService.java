package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Orchestration du parcours 1 ("le collectionneur pressé", étape 5) :
 * créer une Entity et son Ownership initiale en une seule opération,
 * puis publier les domain events accumulés sur les deux agrégats.
 * <p>
 * Implémente la déduplication prévue dès UC1 (étape 6) : si une Entity du
 * même type porte déjà exactement le même titre (insensible à la casse),
 * on ne recrée pas de doublon dans le Catalog - on rattache simplement une
 * nouvelle Ownership à l'Entity existante (typiquement : un deuxième
 * exemplaire du même tome, ou un re-scan accidentel du même code-barres).
 */
@Service
public class QuickAddService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ApplicationEventPublisher eventPublisher;

    public QuickAddService(EntityRepository entityRepository,
                            OwnershipRepository ownershipRepository,
                            ApplicationEventPublisher eventPublisher) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.eventPublisher = eventPublisher;
    }

    /** Résultat de l'ajout rapide : indique si un doublon a été évité en réutilisant une Entity existante. */
    public record QuickAddResult(UUID entityId, boolean matchedExistingEntity) {
    }

    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition) {
        return addNewEntityWithOwnership(entityTypeId, title, condition, Map.of());
    }

    /**
     * Variante acceptant des attributs pré-remplis - typiquement issus
     * d'un MetadataCandidate choisi après une recherche via
     * MetadataSearchService (module Metadata Enrichment). Reste
     * volontairement découplée de ce module : QuickAddService ne connaît
     * que des attributs génériques, jamais Jikan/BGG directement.
     */
    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes) {
        String normalizedTitle = title.trim();
        Optional<Entity> existing = entityRepository.findByTypeAndTitle(entityTypeId, normalizedTitle);

        Entity entity;
        boolean matchedExisting = existing.isPresent();

        if (matchedExisting) {
            entity = existing.get();
            // On complète les attributs manquants sans écraser ceux déjà
            // renseignés (ex: une saisie manuelle antérieure ne doit pas
            // être effacée par une recherche de métadonnées ultérieure).
            prefilledAttributes.forEach((key, value) -> {
                if (!entity.attributes().containsKey(key)) {
                    entity.setAttribute(key, value);
                }
            });
        } else {
            entity = Entity.create(entityTypeId, normalizedTitle);
            prefilledAttributes.forEach(entity::setAttribute);
        }

        Ownership ownership = Ownership.acquire(entity.id(), null, condition, LocalDate.now(), null);

        entityRepository.save(entity);
        ownershipRepository.save(ownership);

        entity.pullDomainEvents().forEach(eventPublisher::publishEvent);
        ownership.pullDomainEvents().forEach(eventPublisher::publishEvent);

        return new QuickAddResult(entity.id(), matchedExisting);
    }
}
