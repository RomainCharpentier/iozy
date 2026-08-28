package com.iozycore.application;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
 * ({@code MangaEdition}) correspondante - identifiée-ou-créée avec la même
 * logique de déduplication que la Série/le Tome (voir {@link TomeResolver}),
 * jamais un doublon d'Édition.
 */
@Service
public class QuickAddService {

    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final CatalogEntityResolver catalogEntityResolver;
    private final TomeResolver tomeResolver;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final ApplicationEventPublisher eventPublisher;

    public QuickAddService(EntityRepository entityRepository,
                            OwnershipRepository ownershipRepository,
                            CatalogEntityResolver catalogEntityResolver,
                            TomeResolver tomeResolver,
                            WishlistEntryRepository wishlistEntryRepository,
                            ApplicationEventPublisher eventPublisher) {
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.catalogEntityResolver = catalogEntityResolver;
        this.tomeResolver = tomeResolver;
        this.wishlistEntryRepository = wishlistEntryRepository;
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
        return addNewEntityWithOwnership(entityTypeId, title, condition, prefilledAttributes, volumeNumber, edition,
                volumeImageUrl, purchasePrice, null);
    }

    /**
     * Variante acceptant une DATE d'acquisition, pour un seul usage : annuler un
     * retrait.
     * <p>
     * Retirer un tome supprime son Ownership ; le rajouter en cree une neuve, donc
     * datee d'aujourd'hui. Un aller-retour perdait ainsi la date reelle
     * d'acquisition sans que rien ne le dise - constate le 2026-08-28 sur un tome
     * passe du 26/08 au 28/08 apres un simple clic de trop. L'annulation propose
     * par l'ecran (voir EntityDetailPage) rend donc la date d'origine plutot que
     * d'en inventer une.
     * <p>
     * {@code null} = aujourd'hui, comme avant : c'est un ajout ordinaire.
     */
    public QuickAddResult addNewEntityWithOwnership(UUID entityTypeId, String title, OwnershipCondition condition,
                                                      Map<String, Object> prefilledAttributes,
                                                      Integer volumeNumber, String edition, String volumeImageUrl,
                                                      BigDecimal purchasePrice, LocalDate acquiredAt) {
        // « Faire exister la fiche catalogue » est désormais extrait dans
        // CatalogEntityResolver, partagé avec le parcours Envies : la règle de
        // déduplication (type + titre) et la fusion d'attributs ne vivent qu'à
        // un seul endroit, donc les deux chemins ne peuvent pas produire deux
        // Entity différentes pour la même œuvre. La sauvegarde y est immédiate,
        // ce dont TomeResolver a besoin : une Entity toute neuve doit exister en
        // base avant qu'un MangaEdition ne référence son id (contrainte FK
        // manga_edition.entity_id).
        CatalogEntityResolver.Resolution resolution =
                catalogEntityResolver.resolveOrCreate(entityTypeId, title, prefilledAttributes);
        Entity entity = resolution.entity();
        boolean matchedExisting = resolution.matchedExisting();

        UUID variantId = null;
        boolean matchedExistingVariant = false;
        if (volumeNumber != null) {
            // « Faire exister le tome » vit désormais dans TomeResolver, partagé
            // avec le parcours Envies : la déduplication par libellé et le
            // rattachement à l'Édition catalogue ne sont écrits qu'une fois, donc
            // vouloir puis acheter un tome retombe forcément sur le MÊME Variant.
            TomeResolver.Resolution tome = tomeResolver.resoudre(entity, volumeNumber, edition, volumeImageUrl);
            variantId = tome.variant().id();
            // Un Variant déjà présent sur l'Entity ne veut pas forcément dire que ce
            // tome précis est déjà possédé (il a pu être vendu/perdu depuis, ou
            // n'avoir jamais été que voulu) - on ne signale un doublon que s'il en
            // existe encore une Ownership active.
            UUID finalVariantId = variantId;
            matchedExistingVariant = tome.matchedExisting() && ownershipRepository.findByEntityId(entity.id()).stream()
                    .anyMatch(ownership -> ownership.isActive()
                            && ownership.variantId().map(finalVariantId::equals).orElse(false));
        }

        Ownership ownership = Ownership.acquire(entity.id(), variantId, condition,
                acquiredAt != null ? acquiredAt : LocalDate.now(), null);
        if (purchasePrice != null) {
            ownership.updatePurchasePrice(purchasePrice);
        }

        entityRepository.save(entity);
        ownershipRepository.save(ownership);
        retirerDesEnvies(entity.id(), variantId);

        entity.pullDomainEvents().forEach(eventPublisher::publishEvent);
        ownership.pullDomainEvents().forEach(eventPublisher::publishEvent);

        return new QuickAddResult(entity.id(), matchedExisting, variantId, matchedExistingVariant);
    }

    /**
     * Une œuvre qu'on vient d'acquérir n'est plus une envie.
     * <p>
     * Constaté à l'audit : « Death Note » et « Naruto » apparaissaient à la
     * fois « Possédé » et « Dans vos envies » dans la recherche, faute d'un
     * point où l'envie se referme. Placé ICI et non côté web parce que
     * plusieurs chemins créent une Ownership (ajout depuis une fiche, depuis
     * un aperçu, depuis le scan, saisie manuelle) : les traiter un par un
     * garantissait d'en oublier un.
     * <p>
     * Décision produit tranchée avec l'utilisateur : retirer plutôt que
     * signaler. La conséquence gênante de la première version - acheter un
     * tome effaçait l'envie de TOUTE la série - a disparu avec V21 : l'envie
     * porte désormais sur un tome, et seul celui-là se referme.
     * <p>
     * Idempotent et silencieux : aucune envie pour cette œuvre est le cas de
     * loin le plus fréquent, ce n'est pas une anomalie.
     */
    private void retirerDesEnvies(UUID entityId, UUID variantId) {
        // L'envie qui se referme est celle de l'objet qu'on vient d'acquérir :
        // le TOME s'il y en a un, l'œuvre sinon (type sans notion de tome).
        // Acheter le tome 3 ne doit rien changer à l'envie du tome 7 - c'est
        // tout l'intérêt d'avoir descendu l'envie au tome (voir V21).
        Optional<WishlistEntry> aReferner = variantId != null
                ? wishlistEntryRepository.findByVariantId(variantId)
                : wishlistEntryRepository.findByEntityId(entityId);
        aReferner.ifPresent(entree -> wishlistEntryRepository.deleteById(entree.id()));
    }

}
