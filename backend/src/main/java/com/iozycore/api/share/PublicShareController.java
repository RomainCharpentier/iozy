package com.iozycore.api.share;

import com.iozycore.api.dto.ShareDtos.*;
import com.iozycore.application.TierListService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.share.ShareSettings;
import com.iozycore.domain.share.ShareSettingsRepository;
import com.iozycore.domain.tierlist.Rank;
import com.iozycore.domain.tierlist.TierList;
import com.iozycore.domain.tierlist.TierListItem;
import com.iozycore.domain.tierlist.TierListRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.insights.CollectionProgress;
import com.iozycore.insights.CollectionProgressService;
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
 * Le SEUL contrôleur de l'application conçu pour être ouvert par quelqu'un
 * d'autre que le propriétaire. Il y en avait deux - un par section - et c'est
 * précisément ce que cette unification a supprimé.
 *
 * <h2>Le jeton fait office de mot de passe</h2>
 * Le posséder suffit, il n'y a rien d'autre à présenter : ce contrôleur ne
 * demande aucune authentification, et c'est voulu - la personne qui reçoit le
 * lien n'a pas de compte. Un jeton inconnu, révoqué, vide ou absent donne un
 * <b>404 nu</b>, jamais un détail qui laisserait deviner qu'il a existé un jour.
 *
 * <h2>Le filtrage est ici, pas dans le client</h2>
 * Les sections non partagées ne sont pas masquées à l'affichage : elles ne
 * sont <b>pas calculées</b>, et la réponse porte {@code null} à leur place. Un
 * visiteur qui inspecte le réseau ne trouve pas de collection cachée dans un
 * partage d'envies.
 *
 * <p>{@code null} et non une liste vide, et la nuance porte de l'information :
 * {@code []} dirait « partagée, mais il n'a rien dedans », ce qui est un fait
 * sur la personne ; {@code null} dit seulement « tu n'y as pas accès ». Cette
 * phrase affirmait auparavant que la clé ne figurait pas du tout dans la
 * réponse - c'était faux, le fil porte bien {@code "tierLists":null}, et le
 * test qui semblait le vérifier utilisait {@code doesNotExist()}, vrai pour
 * les deux formes à la fois. Et rien ne sort jamais des œuvres au-delà du titre, de la jaquette,
 * des éditions possédées et de la progression - voir {@code ShareDtos} pour la
 * liste de ce qui est délibérément absent.
 *
 * <h2>Vue vivante, pas photographie</h2>
 * Chaque appel relit la collection et les envies telles qu'elles sont
 * maintenant : ajouter un tome le fait apparaître dans le lien déjà distribué,
 * sans rien à régénérer. La collection ne montre que ce qui est RÉELLEMENT
 * possédé (Ownership active) ; les envies montrent les œuvres souhaitées, <b>y
 * compris celles qu'on ne possède pas</b> - c'est même le cas normal.
 */
@RestController
@RequestMapping("/api/public/share")
@Tag(name = "Espace partagé", description = "Lecture seule, non authentifiée, réservée au porteur du lien")
public class PublicShareController {

    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private final ShareSettingsRepository shareSettingsRepository;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final TierListRepository tierListRepository;
    private final TierListService tierListService;
    private final CollectionProgressService progressService;

    public PublicShareController(ShareSettingsRepository shareSettingsRepository,
                                  EntityRepository entityRepository,
                                  EntityTypeRepository entityTypeRepository,
                                  OwnershipRepository ownershipRepository,
                                  WishlistEntryRepository wishlistEntryRepository,
                                  TierListRepository tierListRepository,
                                  TierListService tierListService,
                                  CollectionProgressService progressService) {
        this.shareSettingsRepository = shareSettingsRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.tierListRepository = tierListRepository;
        this.tierListService = tierListService;
        this.progressService = progressService;
    }

    @Operation(summary = "Espace partagé en lecture seule via un jeton. 404 si le lien n'existe pas ou a été "
            + "supprimé. Une section non partagée vaut null dans la réponse, jamais une liste vide : "
            + "[] dirait « partagée mais rien dedans », null dit « pas d'accès ».")
    @GetMapping("/{token}")
    public SharedSpaceResponse shared(@PathVariable String token) {
        ShareSettings settings = shareSettingsRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lien introuvable"));

        return new SharedSpaceResponse(
                settings.sharesCollection() ? sharedCollection() : null,
                settings.sharesWishlist() ? sharedWishlist() : null,
                settings.sharesTierLists() ? sharedTierLists() : null);
    }

    /** Ce qui est réellement possédé, groupé par univers - jamais le simple catalogue. */
    private List<SharedUniverse> sharedCollection() {
        Map<UUID, CollectionProgress> progressByEntity = progressService.computeAll().stream()
                .collect(Collectors.toMap(CollectionProgress::entityId, p -> p));
        Set<UUID> owned = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .map(Ownership::entityId)
                .collect(Collectors.toSet());

        List<SharedUniverse> universes = new ArrayList<>();
        for (EntityType type : entityTypeRepository.findAll()) {
            List<SharedCollectionItem> items = entityRepository.findAllByType(type.id()).stream()
                    .filter(entity -> owned.contains(entity.id()))
                    .map(entity -> toItem(entity, progressByEntity.get(entity.id())))
                    .sorted(Comparator.comparing(SharedCollectionItem::title, String.CASE_INSENSITIVE_ORDER))
                    .collect(Collectors.toList());
            // Univers sans rien de possédé : absent, jamais une section vide
            // (même règle que Ma collection côté propriétaire).
            if (!items.isEmpty()) {
                universes.add(new SharedUniverse(type.label(), items));
            }
        }
        return universes;
    }

    /**
     * Les envies. Aucune possession n'est requise ni consultée : une œuvre
     * souhaitée n'a le plus souvent aucun exemplaire, c'est tout l'intérêt de
     * la partager. Une œuvre à la fois possédée et souhaitée apparaît dans les
     * deux sections - ce sont deux intentions différentes, pas un doublon.
     */
    private List<SharedWishlistItem> sharedWishlist() {
        return wishlistEntryRepository.findAll().stream()
                .map(this::toWishlistItem)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .sorted(Comparator.comparing(SharedWishlistItem::title, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    /** Vide si l'œuvre référencée a disparu : une entrée orpheline ne doit pas casser la vue publique. */
    private Optional<SharedWishlistItem> toWishlistItem(WishlistEntry entry) {
        return entityRepository.findById(entry.entityId()).map(entity -> {
            Object cover = entity.attributes().get(COVER_IMAGE_URL);
            return new SharedWishlistItem(entity.title(), cover instanceof String url ? url : null, entry.addedAt());
        });
    }

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
                            .map(PublicShareController::toRankedItem)
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
