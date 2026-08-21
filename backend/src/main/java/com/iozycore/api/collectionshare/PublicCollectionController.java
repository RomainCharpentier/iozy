package com.iozycore.api.collectionshare;

import com.iozycore.api.dto.CollectionShareDtos.*;
import com.iozycore.application.TierListService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.collectionshare.CollectionShareSettings;
import com.iozycore.insights.CollectionProgress;
import com.iozycore.insights.CollectionProgressService;
import com.iozycore.domain.collectionshare.CollectionShareSettingsRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.tierlist.Rank;
import com.iozycore.domain.tierlist.TierList;
import com.iozycore.domain.tierlist.TierListItem;
import com.iozycore.domain.tierlist.TierListRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Deuxième (et seul autre) contrôleur de l'app conçu pour être ouvert par
 * quelqu'un d'autre que le propriétaire - voir PublicWishlistController, dont
 * il reprend exactement le raisonnement de sécurité : le jeton fait office de
 * mot de passe, un jeton inconnu ou révoqué donne un 404 nu, jamais un détail
 * qui laisserait deviner qu'il a existé.
 * <p>
 * Contenu volontairement borné (choix utilisateur du 2026-08-20, voir
 * CollectionShareDtos pour la liste de ce qui est délibérément absent) :
 * titre, jaquette, édition(s) possédée(s) et progression X/Y. Aucun prix,
 * aucune valeur, aucun identifiant, aucun lien profond. Les Tier Lists ne
 * sortent que si l'interrupteur dédié est actif (voir
 * CollectionShareSettings.sharesTierLists) - un classement est un jugement
 * personnel, pas un inventaire.
 * <p>
 * Ne montre que ce qui est RÉELLEMENT possédé (Ownership active), jamais le
 * simple catalogue : une fiche créée puis revendue n'a plus à apparaître dans
 * ce que quelqu'un vient regarder.
 */
@RestController
@RequestMapping("/api/public/collection")
@Tag(name = "Public collection", description = "Lecture seule, non authentifiée, réservée au porteur du lien de partage")
public class PublicCollectionController {

    private static final String COVER_IMAGE_URL = "coverImageUrl";
    private static final String VOLUME_NUMBER = "volumeNumber";
    private static final String EDITION = "edition";

    private final CollectionShareSettingsRepository shareSettingsRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final MangaEditionRepository mangaEditionRepository;
    private final TierListRepository tierListRepository;
    private final TierListService tierListService;
    private final CollectionProgressService progressService;

    public PublicCollectionController(CollectionShareSettingsRepository shareSettingsRepository,
                                       EntityRepository entityRepository,
                                       EntityTypeRepository entityTypeRepository,
                                       OwnershipRepository ownershipRepository,
                                       MangaEditionRepository mangaEditionRepository,
                                       TierListRepository tierListRepository,
                                       TierListService tierListService,
                                       CollectionProgressService progressService) {
        this.shareSettingsRepository = shareSettingsRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.mangaEditionRepository = mangaEditionRepository;
        this.tierListRepository = tierListRepository;
        this.tierListService = tierListService;
        this.progressService = progressService;
    }

    @Operation(summary = "Collection partagée en lecture seule via un jeton - 404 si le lien n'existe pas ou a été "
            + "supprimé. tierLists absent (null) quand le propriétaire ne les partage pas.")
    @GetMapping("/{token}")
    public SharedCollectionResponse shared(@PathVariable String token) {
        CollectionShareSettings settings = shareSettingsRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lien introuvable"));

        Map<UUID, CollectionProgress> progressByEntity = progressService.computeAll().stream()
                .collect(Collectors.toMap(CollectionProgress::entityId, p -> p));
        Map<UUID, List<Ownership>> activeByEntity = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .collect(Collectors.groupingBy(Ownership::entityId));

        List<SharedUniverse> universes = new ArrayList<>();
        for (EntityType type : entityTypeRepository.findAll()) {
            List<SharedCollectionItem> items = entityRepository.findAllByType(type.id()).stream()
                    .filter(entity -> activeByEntity.containsKey(entity.id()))
                    .map(entity -> toItem(entity, progressByEntity.get(entity.id())))
                    .sorted(Comparator.comparing(SharedCollectionItem::title, String.CASE_INSENSITIVE_ORDER))
                    .collect(Collectors.toList());
            // Univers sans rien de possédé : absent, jamais une section vide
            // (même règle que Ma collection côté propriétaire).
            if (!items.isEmpty()) {
                universes.add(new SharedUniverse(type.label(), items));
            }
        }

        return new SharedCollectionResponse(universes, settings.sharesTierLists() ? sharedTierLists() : null);
    }

    /**
     * Ne calcule plus rien : la progression vient de CollectionProgressService,
     * source unique depuis le Lot 31. Cette méthode avait sa propre version des
     * règles (éditions déduites des tomes POSSÉDÉS, total pris sur la première
     * édition renseignée), qui donnait ici de meilleurs chiffres que Ma
     * collection - deux réponses différentes à la même question, sur les mêmes
     * données.
     */
    private SharedCollectionItem toItem(Entity entity, CollectionProgress progress) {
        List<String> editions = progress.editions().stream()
                .filter(e -> !e.editionName().isEmpty() && e.ownedCount() > 0)
                .map(CollectionProgress.EditionProgress::editionName)
                .sorted()
                .collect(Collectors.toList());

        // Le total n'a de sens que rattaché à UNE édition : quand plusieurs sont
        // réellement collectionnées, la progression reste sans total plutôt que
        // d'en choisir une au hasard (voir dominantEdition).
        Integer totalVolumes = progress.dominantEdition() == null ? null : progress.dominantEdition().totalVolumes();

        Object cover = entity.attributes().get(COVER_IMAGE_URL);
        return new SharedCollectionItem(entity.title(), cover instanceof String url ? url : null, editions,
                progress.ownedVolumeCount(), totalVolumes);
    }

    private SharedTierLists sharedTierLists() {
        List<SharedTierBoard> general = new ArrayList<>();
        for (EntityType type : entityTypeRepository.findAll()) {
            TierListService.GeneralBoard board = tierListService.generalBoard(type.id());
            List<SharedTierRow> rows = board.ranked().entrySet().stream()
                    .filter(e -> !e.getValue().isEmpty())
                    .sorted(Map.Entry.comparingByKey())
                    .map(e -> new SharedTierRow(e.getKey().name(), e.getValue().stream()
                            .map(PublicCollectionController::toRankedItem)
                            .collect(Collectors.toList())))
                    .collect(Collectors.toList());
            // Un univers sans AUCUNE œuvre classée n'apparaît pas : "rien de
            // classé" n'est pas un classement à montrer.
            if (!rows.isEmpty()) {
                general.add(new SharedTierBoard(type.label(), rows));
            }
        }

        List<SharedTierBoard> custom = new ArrayList<>();
        List<TierList> lists = new ArrayList<>(tierListRepository.findAllUniversesLists());
        for (EntityType type : entityTypeRepository.findAll()) {
            lists.addAll(tierListRepository.findByEntityTypeId(type.id()));
        }
        for (TierList list : lists) {
            Map<Rank, List<SharedRankedItem>> byRank = new EnumMap<>(Rank.class);
            for (Map.Entry<TierListItem, Entity> entry : tierListService.enrichedItems(list.id())) {
                // Seulement ce qui est réellement CLASSÉ : une œuvre ajoutée à
                // la liste mais pas encore classée n'est pas un avis.
                entry.getKey().rank().ifPresent(rank -> byRank
                        .computeIfAbsent(rank, r -> new ArrayList<>())
                        .add(toRankedItem(entry.getValue())));
            }
            if (byRank.isEmpty()) {
                continue;
            }
            List<SharedTierRow> rows = byRank.entrySet().stream()
                    .map(e -> new SharedTierRow(e.getKey().name(), e.getValue()))
                    .collect(Collectors.toList());
            custom.add(new SharedTierBoard(list.name(), rows));
        }

        return new SharedTierLists(general, custom);
    }

    private static SharedRankedItem toRankedItem(Entity entity) {
        Object cover = entity.attributes().get(COVER_IMAGE_URL);
        return new SharedRankedItem(entity.title(), cover instanceof String url ? url : null);
    }
}
