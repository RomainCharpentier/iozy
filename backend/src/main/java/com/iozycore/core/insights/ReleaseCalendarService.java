package com.iozycore.core.insights;

import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Le calendrier des sorties : ce qui sort, quand, pour les œuvres qu'on
 * SUIT - toutes catégories confondues. Suivre est le troisième état d'une
 * œuvre, à côté de posséder et vouloir (voir WorkFollowing) : c'est lui, et
 * lui seul, qui met une œuvre au calendrier ; possessions et envies ne
 * disent plus que ce que chaque sortie représente.
 *
 * <h2>D'où viennent les dates</h2>
 * De deux endroits, et de deux seulement. Chaque univers qui a une vraie
 * source (Google Books pour les tomes d'un manga, IGDB pour un jeu vidéo) est
 * une {@link ReleaseSource} ; le cœur ne connaît aucune d'elles. Et pour
 * n'importe quelle œuvre, l'attribut {@value #RELEASE_DATE_ATTRIBUTE} saisi
 * sur sa fiche - c'est ce qui met les jeux de société et les catégories
 * personnalisées dans le même calendrier, alors qu'aucune source ne sait
 * leur jour de sortie (BoardGameGeek ne donne que l'année).
 *
 * <h2>Ce qu'il ne fait jamais</h2>
 * Inventer une date. « Prochaines sorties » a été retiré de Découvrir au lot
 * 142 précisément parce qu'aucune donnée n'existait, et le journal de design
 * (§44) exige qu'il ne revienne « jamais avec une date approximative ». Une
 * source qui ne connaît que l'année ne met rien ici.
 *
 * <h2>Une lecture par catégorie, pas une par œuvre</h2>
 * Les possessions et les envies sont lues une fois, le catalogue une fois par
 * catégorie, et chaque source reçoit tout cela indexé ({@link ReleaseContext})
 * : sur 300 séries, une source qui relirait les possessions par œuvre
 * coûterait 300 requêtes (lot 141).
 */
@Service
public class ReleaseCalendarService {

    /** L'attribut d'une œuvre qui porte sa date de sortie saisie à la main : « 2026-10-14 » ou « 2026-10 ». */
    public static final String RELEASE_DATE_ATTRIBUTE = "releaseDate";
    /** La source d'une date saisie sur la fiche - le client la nomme comme telle. */
    public static final String MANUAL_SOURCE = "MANUAL";
    /** Un an et un jour : de quoi tourner les pages d'une année entière, pas de quoi charger tout l'historique. */
    static final int MAX_PERIOD_DAYS = 366;

    private static final String COVER_IMAGE_URL = "coverImageUrl";

    private static final Comparator<ReleaseEntry> CALENDAR_ORDER = Comparator
            .comparing(ReleaseEntry::date)
            .thenComparing(entry -> entry.entityTitle().toLowerCase())
            .thenComparing(entry -> entry.volumeNumber() == null ? Integer.MIN_VALUE : entry.volumeNumber())
            .thenComparing(ReleaseEntry::label);

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final FollowedWorkRepository followedWorkRepository;
    private final List<ReleaseSource> sources;

    public ReleaseCalendarService(EntityTypeRepository entityTypeRepository, EntityRepository entityRepository,
                                  OwnershipRepository ownershipRepository,
                                  WishlistEntryRepository wishlistEntryRepository,
                                  FollowedWorkRepository followedWorkRepository, List<ReleaseSource> sources) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.followedWorkRepository = followedWorkRepository;
        this.sources = sources;
    }

    /** Vrai quand un univers sait dater les sorties de cette catégorie sans qu'on les saisisse. */
    public boolean hasReleaseSource(EntityType entityType) {
        return sources.stream().anyMatch(source -> source.supports(entityType));
    }

    /**
     * @throws IllegalArgumentException période absente, à l'envers, ou plus longue qu'une année
     */
    public ReleaseCalendar releasesBetween(LocalDate from, LocalDate to) {
        validatePeriod(from, to);

        List<Ownership> activeOwnerships = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .toList();
        List<WishlistEntry> wishlist = wishlistEntryRepository.findAll();
        // Seules les œuvres SUIVIES entrent au calendrier (un état à la fois :
        // Possédé / Suivi / Envie). Possessions et envies ne servent plus qu'à
        // dire ce que chaque sortie représente.
        Set<UUID> ofInterest = followedWorkRepository.findAll().stream()
                .map(FollowedWork::entityId)
                .collect(Collectors.toCollection(HashSet::new));
        if (ofInterest.isEmpty()) {
            // Rien de suivi : aucune source à consulter, aucun catalogue à lire.
            return new ReleaseCalendar(from, to, List.of());
        }

        List<ReleaseEntry> entries = new ArrayList<>();
        for (EntityType entityType : entityTypeRepository.findAll()) {
            List<Entity> entities = entityRepository.findAllByType(entityType.id()).stream()
                    .filter(entity -> ofInterest.contains(entity.id()))
                    .toList();
            if (entities.isEmpty()) {
                continue;
            }
            Set<UUID> entityIds = entities.stream().map(Entity::id).collect(Collectors.toSet());
            ReleaseContext context = new ReleaseContext(entityType, from, to, entities,
                    activeOwnerships.stream().filter(o -> entityIds.contains(o.entityId())).toList(),
                    wishlist.stream().filter(w -> entityIds.contains(w.entityId())).toList());

            entries.addAll(manualReleases(context));
            for (ReleaseSource source : sources) {
                if (source.supports(entityType)) {
                    entries.addAll(source.releasesBetween(context));
                }
            }
        }
        entries.sort(CALENDAR_ORDER);
        return new ReleaseCalendar(from, to, entries);
    }

    /** Les dates saisies sur les fiches - pour toute catégorie, qu'un univers la couvre ou non. */
    private static List<ReleaseEntry> manualReleases(ReleaseContext context) {
        List<ReleaseEntry> entries = new ArrayList<>();
        for (Entity entity : context.entities()) {
            ReleaseDate.parse(entity.attributes().get(RELEASE_DATE_ATTRIBUTE))
                    .filter(date -> date.isWithin(context.from(), context.to()))
                    .ifPresent(date -> context.relationOf(entity.id()).ifPresent(relation ->
                            entries.add(new ReleaseEntry(date, entity.id(), entity.title(), entity.entityTypeId(),
                                    "", null, null, coverOf(entity), relation, MANUAL_SOURCE))));
        }
        return entries;
    }

    private static String coverOf(Entity entity) {
        Object cover = entity.attributes().get(COVER_IMAGE_URL);
        return cover instanceof String url && !url.isBlank() ? url : null;
    }

    private static void validatePeriod(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new IllegalArgumentException("La période du calendrier demande un début et une fin");
        }
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("La fin de la période (" + to + ") précède son début (" + from + ")");
        }
        if (ChronoUnit.DAYS.between(from, to) >= MAX_PERIOD_DAYS) {
            throw new IllegalArgumentException("Le calendrier se lit par tranches d'un an au plus");
        }
    }
}
