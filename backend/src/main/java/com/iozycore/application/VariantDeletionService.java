package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.VariantDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Suppression explicite d'un Tome (Variant) - action utilisateur (voir "Supprimer ce
 * tome"), jamais déclenchée automatiquement. Modèle catalogue cible Série -> Édition ->
 * Tome (étape 4) : un Tome catalogué existe indépendamment de sa possession, donc
 * supprimer sa dernière Ownership active (voir OwnershipDeletionService) ne le
 * supprime JAMAIS - seule cette action explicite le fait, et seulement si plus aucune
 * Ownership ni Experience ne le référence encore (même patron que
 * EntityDeletionService : le domaine Entity ne connaît pas les repositories des
 * autres agrégats, donc la règle est orchestrée ici).
 * <p>
 * Contrairement à EntityDeletionService (bloqué par n'importe quelle Ownership, même
 * vendue/perdue), cette garde ne regarde QUE les Ownership/Experience qui référencent
 * CE Variant précis - un autre tome de la même série peut très bien rester possédé.
 */
@Service
public class VariantDeletionService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;

    public VariantDeletionService(EntityRepository entityRepository,
                                   OwnershipRepository ownershipRepository,
                                   ExperienceRepository experienceRepository) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
    }

    public void delete(UUID entityId, UUID variantId) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new IllegalArgumentException("Entity introuvable : " + entityId));

        long ownershipCount = ownershipRepository.findByEntityId(entityId).stream()
                .filter(ownership -> ownership.variantId().map(variantId::equals).orElse(false))
                .count();
        long experienceCount = experienceRepository.findByEntityId(entityId).stream()
                .filter(experience -> experience.variantId().map(variantId::equals).orElse(false))
                .count();
        if (ownershipCount > 0 || experienceCount > 0) {
            throw new VariantDeletionNotAllowedException(variantId, ownershipCount, experienceCount);
        }

        entity.removeVariant(variantId);
        entityRepository.save(entity);
    }
}
