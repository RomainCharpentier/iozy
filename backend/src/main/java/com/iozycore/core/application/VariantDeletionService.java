package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.EntityDeletionNotAllowedException;
import com.iozycore.core.domain.shared.VariantDeletionNotAllowedException;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.List;

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
 * <p>
 * Étape 5 ("pas de tome -> pas d'édition -> pas de série") : une fois le Tome retiré,
 * cascade vers le haut - son Édition catalogue disparaît à son tour si elle n'a plus
 * aucun Tome, puis la Série elle-même si elle n'a plus aucun Tome du tout (pas
 * seulement plus aucune Édition : un Tome sans édition renseignée compte aussi comme
 * un Tome catalogué réel, voir QuickAddService). Les deux cascades sont silencieuses
 * quand quelque chose d'autre retient encore la donnée (observation de marché sur
 * l'Édition, Ownership générique sans Variant sur la Série...) - ce n'est jamais une
 * erreur pour cet appel, seulement une cascade qui s'arrête là où elle doit.
 */
@Service
public class VariantDeletionService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    /** Ce que chaque univers fait apres la suppression d'un tome - le menage des editions orphelines, cote manga (Lot 133). */
    private final List<VariantDeletionHook> hooks;
    private final EntityDeletionService entityDeletionService;

    public VariantDeletionService(EntityRepository entityRepository,
                                   OwnershipRepository ownershipRepository,
                                   ExperienceRepository experienceRepository,
                                   List<VariantDeletionHook> hooks,
                                   EntityDeletionService entityDeletionService) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.hooks = hooks;
        this.entityDeletionService = entityDeletionService;
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

        Variant tomeSupprime = entity.variants().stream()
                .filter(v -> v.id().equals(variantId))
                .findFirst()
                .orElse(null);

        entity.removeVariant(variantId);
        entityRepository.save(entity);

        // Ce que chaque univers fait apres coup - le manga y efface l'edition
        // de reference devenue orpheline (voir VariantDeletionHook, Lot 133).
        for (VariantDeletionHook hook : hooks) {
            hook.apresSuppression(entity, tomeSupprime, variantId);
        }
        cascadeDeleteEmptySeries(entity);
    }

    /**
     * "Pas de tome -> pas de série" : une Série vidée de tous ses Tomes catalogués (pas
     * seulement de ses Tomes rattachés à une Édition - un Tome sans édition renseignée
     * compte tout autant) devient à son tour candidate à la suppression. Réutilise
     * EntityDeletionService plutôt que de dupliquer sa garde : si elle bloque encore
     * (Ownership générique sans Variant, Édition ayant survécu ci-dessus...), la Série
     * survit simplement - ce n'est pas une erreur pour cet appel.
     */
    private void cascadeDeleteEmptySeries(Entity entity) {
        if (!entity.variants().isEmpty()) {
            return;
        }
        try {
            entityDeletionService.delete(entity.id());
        } catch (EntityDeletionNotAllowedException e) {
            // Encore retenue par autre chose - voir javadoc ci-dessus.
        }
    }
}
