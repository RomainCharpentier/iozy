package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
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
 * <p>
 * Distinction série / tome (Manga) : le titre identifie la SÉRIE (l'Entity),
 * jamais un tome précis - "L'Attaque des Titans" reste une seule fiche que
 * l'on possède en plusieurs tomes, pas une fiche par tome. Un tome précis
 * d'une édition précise (volumeNumber + edition, tous deux optionnels) est
 * modélisé comme un Variant de cette Entity (voir Variant, "ex: Tome 3") et
 * l'Ownership créée y est rattachée via variantId - c'est ce qui permet de
 * distinguer "je possède le tome 3" de "je possède le tome 7" au lieu
 * d'empiler des Ownership anonymes indiscernables sous la même fiche.
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

    /** Résultat de l'ajout rapide : indique si un doublon a été évité en réutilisant
     * une Entity existante, et de même pour le Variant (tome) le cas échéant -
     * variantId est null si aucun numéro de tome n'a été fourni (ex: jeu vidéo,
     * jeu de société, ou manga ajouté sans préciser de tome). */
    public record QuickAddResult(UUID entityId, boolean matchedExistingEntity,
                                  UUID variantId, boolean matchedExistingVariant) {
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
        return addNewEntityWithOwnership(entityTypeId, title, condition, prefilledAttributes, null, null);
    }

    /**
     * Variante complète, utilisée par le formulaire d'ajout rapide : volumeNumber
     * et edition sont tous deux optionnels (null si non renseignés, ex: un jeu
     * vidéo n'a pas de tome). Quand volumeNumber est fourni, l'Ownership créée
     * référence un Variant "Tome N" (ou "Tome N — édition" si edition est
     * renseigné) plutôt que de rester anonyme.
     */
    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes,
                                                      Integer volumeNumber, String edition) {
        return addNewEntityWithOwnership(entityTypeId, title, condition, prefilledAttributes, volumeNumber, edition, null);
    }

    /**
     * Variante complète avec jaquette propre au tome (voir VolumeCandidate,
     * module Metadata Enrichment) - typiquement une jaquette réelle trouvée
     * via la sélection visuelle des tomes (Google Books), distincte de la
     * jaquette de la SÉRIE dans prefilledAttributes (celle de Jikan/MAL).
     * Stockée sur le Variant, jamais sur l'Entity : chaque tome garde sa
     * propre jaquette plutôt que d'écraser celle de la série.
     */
    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes,
                                                      Integer volumeNumber, String edition, String volumeImageUrl) {
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

        UUID variantId = null;
        boolean matchedExistingVariant = false;
        if (volumeNumber != null) {
            String label = variantLabel(volumeNumber, edition);
            Optional<Variant> existingVariant = entity.findVariantByLabel(label);
            Variant variant = existingVariant.orElseGet(() -> entity.addVariant(label, variantAttributes(volumeNumber, edition, volumeImageUrl)));
            variantId = variant.id();
            // Un Variant déjà présent sur l'Entity ne veut pas forcément dire que ce
            // tome précis est déjà possédé (il a pu être vendu/perdu depuis) - on ne
            // signale un doublon que s'il en existe encore une Ownership active.
            UUID finalVariantId = variantId;
            matchedExistingVariant = existingVariant.isPresent() && ownershipRepository.findByEntityId(entity.id()).stream()
                    .anyMatch(ownership -> ownership.isActive()
                            && ownership.variantId().map(finalVariantId::equals).orElse(false));
        }

        Ownership ownership = Ownership.acquire(entity.id(), variantId, condition, LocalDate.now(), null);

        entityRepository.save(entity);
        ownershipRepository.save(ownership);

        entity.pullDomainEvents().forEach(eventPublisher::publishEvent);
        ownership.pullDomainEvents().forEach(eventPublisher::publishEvent);

        return new QuickAddResult(entity.id(), matchedExisting, variantId, matchedExistingVariant);
    }

    private String variantLabel(int volumeNumber, String edition) {
        String base = "Tome " + volumeNumber;
        return (edition == null || edition.isBlank()) ? base : base + " — " + edition.trim();
    }

    private Map<String, Object> variantAttributes(int volumeNumber, String edition, String volumeImageUrl) {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("volumeNumber", volumeNumber);
        if (edition != null && !edition.isBlank()) {
            attributes.put("edition", edition.trim());
        }
        // Même clé que COVER_IMAGE_ATTRIBUTE_KEY côté web/iOS (voir
        // lib/coverImage.ts) - convention partagée pour qu'une jaquette de
        // Variant se lise avec exactement la même fonction qu'une jaquette
        // d'Entity, seule la source (Entity.attributes vs Variant.attributes)
        // change à l'appel.
        if (volumeImageUrl != null && !volumeImageUrl.isBlank()) {
            attributes.put("coverImageUrl", volumeImageUrl);
        }
        return attributes;
    }
}
