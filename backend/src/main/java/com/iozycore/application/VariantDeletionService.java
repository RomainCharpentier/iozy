package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.EntityDeletionNotAllowedException;
import com.iozycore.domain.shared.VariantDeletionNotAllowedException;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
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
    private final MangaEditionRepository mangaEditionRepository;
    private final MarketPriceObservationRepository marketPriceObservationRepository;
    private final EntityDeletionService entityDeletionService;

    public VariantDeletionService(EntityRepository entityRepository,
                                   OwnershipRepository ownershipRepository,
                                   ExperienceRepository experienceRepository,
                                   MangaEditionRepository mangaEditionRepository,
                                   MarketPriceObservationRepository marketPriceObservationRepository,
                                   EntityDeletionService entityDeletionService) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.mangaEditionRepository = mangaEditionRepository;
        this.marketPriceObservationRepository = marketPriceObservationRepository;
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

        UUID removedMangaEditionId = entity.variants().stream()
                .filter(v -> v.id().equals(variantId))
                .findFirst()
                .map(Variant::mangaEditionId)
                .orElse(null);

        entity.removeVariant(variantId);
        entityRepository.save(entity);

        cascadeDeleteOrphanedEdition(entity, removedMangaEditionId);
        cascadeDeleteEmptySeries(entity);
    }

    /**
     * Une Édition catalogue devenue vide de tout Tome (dans cette Série - une Édition
     * n'appartient qu'à une seule Série une fois {@code entityId} renseigné) est
     * supprimée à son tour. Vérifiée AVANT de tenter la suppression plutôt que
     * rattrapée après coup : une contrainte FK violée avorte toute la transaction
     * Postgres en cours (pas seulement l'appel fautif), ce qui casserait le cascade
     * suivant ({@link #cascadeDeleteEmptySeries}) même avec un try/catch autour du
     * seul appel risqué. Conservée intentionnellement si une observation de marché
     * (Analyse d'achat) la référence encore - ce n'est pas une erreur, l'Édition
     * redevient une simple donnée de référence, plus rattachée à aucun Tome catalogué
     * actuel, réutilisable si un Tome de cette édition est ajouté de nouveau plus tard.
     */
    private void cascadeDeleteOrphanedEdition(Entity entity, UUID mangaEditionId) {
        if (mangaEditionId == null) {
            return;
        }
        boolean stillReferenced = entity.variants().stream()
                .anyMatch(v -> mangaEditionId.equals(v.mangaEditionId()));
        if (stillReferenced) {
            return;
        }
        if (!marketPriceObservationRepository.findByEditionId(mangaEditionId).isEmpty()) {
            return;
        }
        mangaEditionRepository.deleteById(mangaEditionId);
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
