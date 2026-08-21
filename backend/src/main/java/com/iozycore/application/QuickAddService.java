package com.iozycore.application;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.VariantLabels;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
 * <p>
 * Modèle catalogue cible Série -> Édition -> Tome (étape 3) : quand une
 * édition est renseignée, ce Variant est aussi relié à l'Édition catalogue
 * ({@link MangaEdition}) correspondante - identifiée-ou-créée avec la même
 * logique de déduplication que la Série/le Tome (voir
 * {@link #resolveOrCreateMangaEdition}), jamais un doublon d'Édition.
 */
@Service
public class QuickAddService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final MangaEditionRepository mangaEditionRepository;
    private final CatalogEntityResolver catalogEntityResolver;
    private final ApplicationEventPublisher eventPublisher;

    public QuickAddService(EntityRepository entityRepository,
                            OwnershipRepository ownershipRepository,
                            MangaEditionRepository mangaEditionRepository,
                            CatalogEntityResolver catalogEntityResolver,
                            ApplicationEventPublisher eventPublisher) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.mangaEditionRepository = mangaEditionRepository;
        this.catalogEntityResolver = catalogEntityResolver;
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
        return addNewEntityWithOwnership(
                entityTypeId, title, condition, prefilledAttributes, volumeNumber, edition, volumeImageUrl, null);
    }

    /**
     * Variante complète avec prix d'achat optionnel (voir Ownership.updatePurchasePrice) -
     * jamais deviné : null si non renseigné à l'ajout, reste modifiable ensuite
     * via PATCH /api/ownerships/{id}/purchase-price.
     */
    @Transactional
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes,
                                                      Integer volumeNumber, String edition, String volumeImageUrl,
                                                      BigDecimal purchasePrice) {
        // « Faire exister la fiche catalogue » est désormais extrait dans
        // CatalogEntityResolver, partagé avec le parcours Envies : la règle de
        // déduplication (type + titre) et la fusion d'attributs ne vivent qu'à
        // un seul endroit, donc les deux chemins ne peuvent pas produire deux
        // Entity différentes pour la même œuvre. La sauvegarde y est immédiate,
        // ce dont resolveOrCreateMangaEdition ci-dessous a besoin : une Entity
        // toute neuve doit exister en base avant qu'un MangaEdition ne
        // référence son id (contrainte FK manga_edition.entity_id).
        CatalogEntityResolver.Resolution resolution =
                catalogEntityResolver.resolveOrCreate(entityTypeId, title, prefilledAttributes);
        Entity entity = resolution.entity();
        boolean matchedExisting = resolution.matchedExisting();

        UUID variantId = null;
        boolean matchedExistingVariant = false;
        if (volumeNumber != null) {
            String label = VariantLabels.of(volumeNumber, edition);
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

            // Modèle catalogue cible (Série -> Édition -> Tome, étape 3) : quand une
            // édition est renseignée, résout-ou-crée l'Édition catalogue correspondante
            // et relie ce Tome dessus - même patron identifier-ou-créer que pour la
            // Série/le Tome eux-mêmes ci-dessus, jamais de doublon d'Édition (unicité
            // seriesTitle+editionName). Aucune tentative d'enrichissement externe ici
            // (Jikan/Google Books/IA) - seulement le matching déjà en place, voir étape 7.
            if (edition != null && !edition.isBlank()) {
                UUID mangaEditionId = resolveOrCreateMangaEdition(entity, edition.trim());
                entity.linkVariantToEdition(variantId, mangaEditionId);
            }
        }

        Ownership ownership = Ownership.acquire(entity.id(), variantId, condition, LocalDate.now(), null);
        if (purchasePrice != null) {
            ownership.updatePurchasePrice(purchasePrice);
        }

        entityRepository.save(entity);
        ownershipRepository.save(ownership);

        entity.pullDomainEvents().forEach(eventPublisher::publishEvent);
        ownership.pullDomainEvents().forEach(eventPublisher::publishEvent);

        return new QuickAddResult(entity.id(), matchedExisting, variantId, matchedExistingVariant);
    }

    /**
     * Identifier-ou-créer pour l'Édition catalogue, symétrique de la déduplication
     * Série/Tome ci-dessus. Cherche par entityId D'ABORD (voir migration "Série ->
     * Édition par ID", historique de la conversation) - entity.id() est connu avec
     * certitude ici, jamais besoin de repasser par une correspondance de titre pour UNE
     * Entity qu'on a déjà en main. Le repli par titre ne sert plus que pour une édition
     * pas encore reliée (ex: créée depuis l'Analyse d'achat avant que cette série soit
     * en collection) - reliée ici même, opportunistement, dès qu'elle est retrouvée
     * ainsi : jamais l'inverse, on ne force jamais un entityId sur une édition qui en a
     * déjà un différent. Sans ce repli par ID en premier, un renommage de Série aurait
     * rendu une édition déjà reliée introuvable par entity.title() (désormais différent
     * de l'ancien MangaEdition.seriesTitle, jamais mis à jour en cascade) et en aurait
     * créé un doublon vide à chaque nouvel ajout. Une édition réellement nouvelle est
     * créée avec le strict minimum connu (nom + tier OTHER, tout le reste null) - à
     * enrichir plus tard, jamais deviné à la création.
     */
    private UUID resolveOrCreateMangaEdition(Entity entity, String editionName) {
        Optional<MangaEdition> byId = mangaEditionRepository.findByEntityIdAndEditionName(entity.id(), editionName);
        if (byId.isPresent()) {
            return byId.get().id();
        }
        Optional<MangaEdition> existing = mangaEditionRepository.findBySeriesAndEdition(entity.title(), editionName);
        if (existing.isPresent()) {
            MangaEdition mangaEdition = existing.get();
            if (mangaEdition.entityId() == null) {
                mangaEdition = mangaEditionRepository.save(mangaEdition.withEntityId(entity.id()));
            }
            return mangaEdition.id();
        }
        MangaEdition created = MangaEdition.create(entity.id(), entity.title(), editionName, EditionTier.OTHER,
                null, null, null, false, false, null);
        return mangaEditionRepository.save(created).id();
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
