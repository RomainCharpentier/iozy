package com.iozycore.videogame;

import com.iozycore.core.application.work.ElementAcquisition;
import com.iozycore.core.application.work.WorkElementsSource;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.domain.work.DefaultWorkElements;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkElementsContext;
import com.iozycore.core.domain.work.WorkElementsOrigin;
import com.iozycore.videogame.franchise.FranchiseCache;
import com.iozycore.videogame.franchise.FranchiseGame;
import com.iozycore.videogame.franchise.FranchiseSource;
import com.iozycore.videogame.franchise.StoredFranchise;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The elements of a video game: the game itself, then the other games of its
 * licence ON THE SAME CONSOLE, as optional elements.
 *
 * <h2>Nothing stored moves</h2>
 * Each game stays a work of its own, owned per copy with its console
 * ({@code ownership.platform}). The licence is reference data read from IGDB
 * ({@code video_game_franchise_cache}, filled by
 * {@link VideoGameFranchiseBackfill}). A game of the licence is owned when
 * the account has a copy of it (same IGDB id, or same title) on that console.
 *
 * <h2>The console</h2>
 * The console of the copies of the game; when no copy says it, the console
 * written on the game ({@code platform}). With no console known, the licence
 * is not shown: listing the games of every console would mix collections.
 * Consoles are compared by their canonical name ({@link Consoles}): a copy on
 * "Switch" is on IGDB's "Nintendo Switch". A game owned on two consoles lists
 * each other game of the licence once, on the first of its consoles that the
 * other game exists on - and "je l'ai" adds it on that console.
 *
 * <h2>When games of the licence count as missing</h2>
 * One game of a licence is a game, not a collection: owning Breath of the Wild
 * does not make every Zelda on Switch "missing". The games of the licence are
 * listed, but they count as missing only once the
 * collector owns at least two games of the licence on that console - the
 * game itself included. Until then they are optional, and out of the total:
 * one Zelda on Switch is 1 of 1, not 1 of 12.
 *
 * <h2>In a list</h2>
 * Each game of a licence is a work of its own, and would list the others:
 * summed over a list, a missing game would count once per owned game of the
 * licence. So the licence is shown on the page of a game only; in a list
 * ({@link WorkElementsContext#list()}) a game is the game alone.
 *
 * <h2>Without IGDB</h2>
 * IGDB is optional. Without its key, or for a game not read yet, the work is
 * the game alone and the origin says why ({@link WorkElementsOrigin#fallback}).
 */
@Component
public class VideoGameWorkElements implements WorkElementsSource {

    static final String PROVIDER = "IGDB";
    static final String KEY_PREFIX = "igdb-";
    static final String NO_KEY = "Licence indisponible : clé IGDB absente";
    static final String NOT_LINKED = "Jeu non relié à IGDB : licence inconnue";
    static final String NOT_READ_YET = "Licence pas encore lue sur IGDB";
    static final String NO_CONSOLE = "Console inconnue : licence non affichée";
    static final String NONE_ON_CONSOLE = "Aucun autre jeu de la licence sur cette console";
    /** Owned games of the licence on the console, the game itself included, before the others count. */
    static final int GAMES_TO_FOLLOW_A_LICENCE = 2;
    private static final String IGDB_ID = VideoGameFranchiseBackfill.IGDB_ID;
    private static final String PLATFORM = "platform";

    private final FranchiseCache cache;
    private final FranchiseSource source;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final ElementAcquisition acquisition;

    public VideoGameWorkElements(FranchiseCache cache, FranchiseSource source,
                                 EntityRepository entityRepository, OwnershipRepository ownershipRepository,
                                 WishlistEntryRepository wishlistEntryRepository, ElementAcquisition acquisition) {
        this.cache = cache;
        this.source = source;
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.acquisition = acquisition;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "VIDEO_GAME".equals(entityType.code());
    }

    @Override
    public List<WorkElements> elementsOf(WorkElementsContext context) {
        Map<UUID, List<Ownership>> ownerships = context.ownershipsByWork();
        Map<UUID, List<WishlistEntry>> wishes = context.wishesByWork();
        Map<UUID, List<ReleaseEntry>> releases = context.releasesByWork();
        if (context.list()) {
            return context.works().stream()
                    .map(game -> alone(game, DefaultWorkElements.wholeWork(game,
                            ownerships.getOrDefault(game.id(), List.of()), wishes.getOrDefault(game.id(), List.of()),
                            releases.getOrDefault(game.id(), List.of()), context.today()), null))
                    .toList();
        }
        boolean configured = source.configured();
        Set<String> ids = new HashSet<>();
        context.works().forEach(game -> Optional.ofNullable(igdbIdOf(game)).ifPresent(ids::add));
        Map<String, StoredFranchise> stored = configured && !ids.isEmpty() ? cache.findAll(ids) : Map.of();
        boolean anyGame = stored.values().stream().anyMatch(row -> !row.franchise().games().isEmpty());
        AccountGames account = anyGame ? readAccount(context.entityType()) : AccountGames.EMPTY;

        List<WorkElements> result = new ArrayList<>();
        for (Entity game : context.works()) {
            List<Ownership> owned = ownerships.getOrDefault(game.id(), List.of());
            WorkElement whole = DefaultWorkElements.wholeWork(game, owned,
                    wishes.getOrDefault(game.id(), List.of()), releases.getOrDefault(game.id(), List.of()),
                    context.today());
            String igdbId = igdbIdOf(game);
            StoredFranchise row = igdbId == null ? null : stored.get(igdbId);
            result.add(elementsOf(game, whole, owned, configured, row, account, context.today()));
        }
        return result;
    }

    private WorkElements elementsOf(Entity game, WorkElement whole, List<Ownership> owned, boolean configured,
                                    StoredFranchise row, AccountGames account, LocalDate today) {
        if (!configured) {
            return alone(game, whole, WorkElementsOrigin.fallback(PROVIDER, NO_KEY));
        }
        if (igdbIdOf(game) == null) {
            return alone(game, whole, WorkElementsOrigin.fallback(PROVIDER, NOT_LINKED));
        }
        if (row == null) {
            return alone(game, whole, WorkElementsOrigin.fallback(PROVIDER, NOT_READ_YET));
        }
        if (row.franchise().games().isEmpty()) {
            return alone(game, whole, WorkElementsOrigin.answered(PROVIDER, null, null));
        }
        Map<String, String> consoles = consolesOf(game, owned);
        if (consoles.isEmpty()) {
            return alone(game, whole, WorkElementsOrigin.fallback(PROVIDER, NO_CONSOLE));
        }
        String title = TexteRecherche.normaliser(game.title());
        List<FranchiseGame> licence = row.franchise().games().stream()
                .filter(other -> !other.igdbId().equals(igdbIdOf(game)))
                .filter(other -> !TexteRecherche.normaliser(other.name()).equals(title))
                .toList();
        Map<String, Long> ownedOn = new HashMap<>();
        List<OnConsole> others = new ArrayList<>();
        for (FranchiseGame other : licence) {
            consoleOf(other, consoles).ifPresent(console -> {
                WorkElement element = derived(game, other, console, account, today);
                others.add(new OnConsole(element, console));
                if (element.state() == WorkElement.State.OWNED) {
                    ownedOn.merge(console, 1L, Long::sum);
                }
            });
        }
        String scope = String.join(" · ", consoles.values());
        if (others.isEmpty() && !licence.isEmpty()) {
            return alone(game, whole,
                    new WorkElementsOrigin(PROVIDER, true, NONE_ON_CONSOLE, row.franchise().name(), scope));
        }
        long gameItself = whole.state() == WorkElement.State.OWNED ? 1 : 0;
        List<WorkElement> elements = new ArrayList<>();
        elements.add(whole);
        others.stream()
                .map(on -> on.element().withOptional(
                        gameItself + ownedOn.getOrDefault(on.console(), 0L) < GAMES_TO_FOLLOW_A_LICENCE))
                .sorted(Comparator.comparing((WorkElement e) -> e.releaseDate() == null ? null : e.releaseDate().date(),
                                Comparator.nullsLast(Comparator.<LocalDate>naturalOrder()))
                        .thenComparing(e -> e.label().toLowerCase()))
                .forEach(elements::add);
        return new WorkElements(game.id(), elements, WorkElements.followedCount(elements),
                WorkElementsOrigin.answered(PROVIDER, row.franchise().name(), scope));
    }

    /** A game of the licence and the console (canonical name) it is listed on. */
    private record OnConsole(WorkElement element, String console) {
    }

    /** The first console of the work (canonical name) that the other game exists on. */
    static Optional<String> consoleOf(FranchiseGame other, Map<String, String> consoles) {
        Set<String> platforms = other.platforms().stream().map(Consoles::canonical).collect(Collectors.toSet());
        return consoles.keySet().stream().filter(platforms::contains).findFirst();
    }

    private static WorkElements alone(Entity game, WorkElement whole, WorkElementsOrigin origin) {
        return new WorkElements(game.id(), List.of(whole), 1, origin);
    }

    private static WorkElement derived(Entity game, FranchiseGame other, String console,
                                       AccountGames account, LocalDate today) {
        Optional<Entity> linked = account.find(other.igdbId(), other.name())
                .filter(entity -> !entity.id().equals(game.id()));
        Ownership ownership = linked.flatMap(entity -> account.copies().getOrDefault(entity.id(), List.of()).stream()
                        .filter(copy -> copy.platform().isEmpty()
                                || Consoles.canonical(copy.platform().get()).equals(console))
                        .findFirst())
                .orElse(null);
        boolean wanted = linked.map(entity -> account.wished().contains(entity.id())).orElse(false);
        ReleaseDate date = ReleaseDate.parse(other.releaseDate()).orElse(null);
        return new WorkElement(KEY_PREFIX + other.igdbId(), other.name(), null, other.coverUrl(),
                WorkElement.stateOf(ownership != null, wanted, date, today), date, null,
                ownership == null ? null : ownership.id(), false, linked.map(Entity::id).orElse(null));
    }

    /** Canonical console -> console as written: the consoles of the copies, else the console of the game. */
    static Map<String, String> consolesOf(Entity game, List<Ownership> activeCopies) {
        Map<String, String> consoles = new LinkedHashMap<>();
        activeCopies.stream()
                .map(Ownership::platform)
                .flatMap(Optional::stream)
                .filter(platform -> !platform.isBlank())
                .forEach(platform -> consoles.putIfAbsent(Consoles.canonical(platform), platform.trim()));
        if (consoles.isEmpty()) {
            Object written = game.attributes().get(PLATFORM);
            if (written instanceof String platform && !platform.isBlank()) {
                consoles.put(Consoles.canonical(platform), platform.trim());
            }
        }
        return consoles;
    }

    @Override
    public boolean own(EntityType entityType, Entity work, WorkElement element) {
        if (!element.key().startsWith(KEY_PREFIX)) {
            return false;
        }
        String otherId = element.key().substring(KEY_PREFIX.length());
        String igdbId = igdbIdOf(work);
        FranchiseGame other = igdbId == null ? null : cache.findAll(Set.of(igdbId)).values().stream()
                .flatMap(row -> row.franchise().games().stream())
                .filter(candidate -> candidate.igdbId().equals(otherId))
                .findFirst().orElse(null);
        List<Ownership> copies = ownershipRepository.findByEntityId(work.id()).stream()
                .filter(Ownership::isActive).toList();
        Map<String, String> consoles = consolesOf(work, copies);
        // The console the element is listed on: the first console of the work the other game exists on.
        String console = Optional.ofNullable(other).flatMap(game -> consoleOf(game, consoles)).map(consoles::get)
                .or(() -> consoles.values().stream().findFirst())
                .orElse(null);
        if (element.linkedEntityId() != null) {
            acquisition.own(element.linkedEntityId(), null, console);
            return true;
        }
        if (other == null) {
            return false;
        }
        Optional<Entity> inCatalog = entityRepository.findAllByType(entityType.id()).stream()
                .filter(entity -> otherId.equals(igdbIdOf(entity)))
                .findFirst();
        if (inCatalog.isPresent()) {
            acquisition.own(inCatalog.get().id(), null, console);
            return true;
        }
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put(IGDB_ID, other.igdbId());
        if (other.coverUrl() != null) {
            attributes.put("coverImageUrl", other.coverUrl());
        }
        if (console != null) {
            attributes.put(PLATFORM, console);
        }
        if (!other.platforms().isEmpty()) {
            attributes.put("platforms", String.join(", ", other.platforms()));
        }
        if (other.releaseDate() != null) {
            attributes.put("releaseDate", other.releaseDate());
        }
        acquisition.ownWork(entityType.id(), other.name(), attributes, console);
        return true;
    }

    /** The video games of the account: their active copies and wishes, by IGDB id and by title. */
    private AccountGames readAccount(EntityType type) {
        List<Ownership> active = ownershipRepository.findAll().stream().filter(Ownership::isActive).toList();
        List<WishlistEntry> wishes = wishlistEntryRepository.findAll();
        Set<UUID> ids = new HashSet<>();
        active.forEach(o -> ids.add(o.entityId()));
        wishes.forEach(w -> ids.add(w.entityId()));
        Map<String, Entity> byIgdbId = new HashMap<>();
        Map<String, Entity> byTitle = new HashMap<>();
        for (Entity entity : ids.isEmpty() ? List.<Entity>of() : entityRepository.findAllById(ids)) {
            if (!type.id().equals(entity.entityTypeId())) {
                continue;
            }
            Optional.ofNullable(igdbIdOf(entity)).ifPresent(id -> byIgdbId.putIfAbsent(id, entity));
            byTitle.putIfAbsent(TexteRecherche.normaliser(entity.title()), entity);
        }
        Map<UUID, List<Ownership>> copies = active.stream().collect(Collectors.groupingBy(Ownership::entityId));
        Set<UUID> wished = wishes.stream().map(WishlistEntry::entityId).collect(Collectors.toSet());
        return new AccountGames(byIgdbId, byTitle, copies, wished);
    }

    record AccountGames(Map<String, Entity> byIgdbId, Map<String, Entity> byTitle, Map<UUID, List<Ownership>> copies,
                        Set<UUID> wished) {

        static final AccountGames EMPTY = new AccountGames(Map.of(), Map.of(), Map.of(), Set.of());

        Optional<Entity> find(String igdbId, String name) {
            return Optional.ofNullable(byIgdbId.get(igdbId))
                    .or(() -> Optional.ofNullable(byTitle.get(TexteRecherche.normaliser(name))));
        }
    }

    static String igdbIdOf(Entity game) {
        return VideoGameFranchiseBackfill.textOf(game.attributes().get(IGDB_ID));
    }
}
