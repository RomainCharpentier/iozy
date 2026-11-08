package com.iozycore.boardgame;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.boardgame.expansion.ExpansionCache;
import com.iozycore.boardgame.expansion.StoredExpansions;
import com.iozycore.core.application.work.ElementAcquisition;
import com.iozycore.core.application.work.WorkElementsSource;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.Variant;
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
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The elements of a board game: the base game first, then its expansions.
 *
 * <h2>Where the expansions come from</h2>
 * <ul>
 *   <li>the variants of the game (an expansion the collector added to it);</li>
 *   <li>the expansions BoardGameGeek lists for the game ({@code board_game_expansion_cache},
 *       filled by {@link BoardGameExpansionBackfill}), each one shown once: a variant with its BGG
 *       id or its name stands for it.</li>
 * </ul>
 * An expansion read from BGG is owned when the account owns a work of the
 * catalog with its BGG id or its name (an expansion imported as a game of its
 * own), wanted when such a work is in the wishes. Nothing stored is moved.
 *
 * <h2>When expansions count as missing</h2>
 * Many players never buy an expansion: listing thirty of them as "missing"
 * would make every board game look unfinished. So the expansions are listed,
 * but they count as missing only once the collector owns at least one
 * expansion of that game - then they follow its expansions. Until then they
 * are optional.
 *
 * <h2>Without BGG</h2>
 * A game with no BGG id, or not read yet, keeps its catalog elements, and the
 * origin says so ({@link WorkElementsOrigin#fallback}).
 */
@Component
public class BoardGameWorkElements implements WorkElementsSource {

    static final String PROVIDER = "BGG";
    static final String KEY_PREFIX = "bgg-";
    static final String NOT_LINKED = "Jeu non relié à BoardGameGeek : extensions inconnues";
    static final String NOT_READ_YET = "Extensions pas encore lues sur BoardGameGeek";
    private static final String BGG_ID = BoardGameExpansionBackfill.BGG_ID;

    private final ExpansionCache cache;
    private final EntityRepository entityRepository;
    private final OwnershipRepository ownershipRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final ElementAcquisition acquisition;

    public BoardGameWorkElements(ExpansionCache cache, EntityRepository entityRepository,
                                 OwnershipRepository ownershipRepository,
                                 WishlistEntryRepository wishlistEntryRepository, ElementAcquisition acquisition) {
        this.cache = cache;
        this.entityRepository = entityRepository;
        this.ownershipRepository = ownershipRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.acquisition = acquisition;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "BOARD_GAME".equals(entityType.code());
    }

    @Override
    public List<WorkElements> elementsOf(WorkElementsContext context) {
        Map<UUID, List<Ownership>> ownerships = context.ownershipsByWork();
        Map<UUID, List<WishlistEntry>> wishes = context.wishesByWork();
        Map<UUID, List<ReleaseEntry>> releases = context.releasesByWork();
        Set<String> bggIds = new HashSet<>();
        context.works().forEach(game -> Optional.ofNullable(bggIdOf(game.attributes())).ifPresent(bggIds::add));
        Map<String, StoredExpansions> stored = bggIds.isEmpty() ? Map.of() : cache.findAll(bggIds);
        boolean anyExpansion = stored.values().stream().anyMatch(row -> !row.expansions().isEmpty());
        AccountGames account = anyExpansion ? readAccount(context.entityType()) : AccountGames.EMPTY;

        List<WorkElements> result = new ArrayList<>();
        for (Entity game : context.works()) {
            List<Ownership> owned = ownerships.getOrDefault(game.id(), List.of());
            List<WishlistEntry> wished = wishes.getOrDefault(game.id(), List.of());
            List<Ownership> baseCopies = owned.stream().filter(o -> o.variantId().isEmpty()).toList();
            String bggId = bggIdOf(game.attributes());
            StoredExpansions row = bggId == null ? null : stored.get(bggId);
            result.add(elementsOf(game, game.variants().isEmpty() ? owned : baseCopies, owned, wished,
                    releases.getOrDefault(game.id(), List.of()), row, account, context));
        }
        return result;
    }

    private WorkElements elementsOf(Entity game, List<Ownership> baseCopies, List<Ownership> owned,
                                    List<WishlistEntry> wished, List<ReleaseEntry> releases, StoredExpansions row,
                                    AccountGames account, WorkElementsContext context) {
        List<WorkElement> expansions = new ArrayList<>();
        List<BoardGameExpansion> fromBgg = new ArrayList<>(row == null ? List.of() : row.expansions());
        game.variants().stream()
                .sorted((a, b) -> DefaultWorkElements.DISPLAY_ORDER.compare(
                        DefaultWorkElements.ofVariant(a, owned, wished, context.today()),
                        DefaultWorkElements.ofVariant(b, owned, wished, context.today())))
                .forEach(variant -> {
                    WorkElement element = DefaultWorkElements.ofVariant(variant, owned, wished, context.today());
                    Optional<BoardGameExpansion> same = fromBgg.stream()
                            .filter(expansion -> standsFor(variant, expansion, game.title()))
                            .findFirst();
                    same.ifPresent(fromBgg::remove);
                    if (element.coverImageUrl() == null && same.isPresent() && same.get().imageUrl() != null) {
                        element = new WorkElement(element.key(), element.label(), element.number(),
                                same.get().imageUrl(), element.state(), element.releaseDate(), element.variantId(),
                                element.ownershipId());
                    }
                    expansions.add(element);
                });
        for (BoardGameExpansion expansion : fromBgg) {
            if (Objects.equals(expansion.bggId(), bggIdOf(game.attributes()))) {
                continue;
            }
            expansions.add(derived(game, expansion, account));
        }
        boolean followsExpansions = expansions.stream().anyMatch(e -> e.state() == WorkElement.State.OWNED);
        List<WorkElement> elements = new ArrayList<>();
        elements.add(DefaultWorkElements.wholeWork(game, baseCopies, wished, releases, context.today()));
        expansions.forEach(element -> elements.add(element.withOptional(!followsExpansions)));
        return new WorkElements(game.id(), elements, elements.size(), originOf(game, row));
    }

    private static WorkElement derived(Entity game, BoardGameExpansion expansion, AccountGames account) {
        Optional<Entity> linked = account.find(expansion.bggId(), expansion.name())
                .filter(entity -> !entity.id().equals(game.id()));
        Ownership ownership = linked.map(entity -> account.ownedCopies().get(entity.id())).orElse(null);
        boolean wanted = linked.map(entity -> account.wished().contains(entity.id())).orElse(false);
        WorkElement.State state = ownership != null ? WorkElement.State.OWNED
                : wanted ? WorkElement.State.WANTED : WorkElement.State.MISSING;
        return new WorkElement(KEY_PREFIX + expansion.bggId(), shortName(game.title(), expansion.name()), null,
                expansion.imageUrl(), state, null, null, ownership == null ? null : ownership.id(), false,
                linked.map(Entity::id).orElse(null));
    }

    static WorkElementsOrigin originOf(Entity game, StoredExpansions row) {
        if (bggIdOf(game.attributes()) == null) {
            return WorkElementsOrigin.fallback(PROVIDER, NOT_LINKED);
        }
        if (row == null) {
            return WorkElementsOrigin.fallback(PROVIDER, NOT_READ_YET);
        }
        return WorkElementsOrigin.answered(PROVIDER, null, null);
    }

    /** A variant stands for a BGG expansion when it carries its id, or its name. */
    static boolean standsFor(Variant variant, BoardGameExpansion expansion, String baseTitle) {
        String variantBggId = bggIdOf(variant.attributes());
        if (variantBggId != null) {
            return variantBggId.equals(expansion.bggId());
        }
        String label = TexteRecherche.normaliser(variant.label());
        return !label.isEmpty() && (label.equals(TexteRecherche.normaliser(expansion.name()))
                || label.equals(TexteRecherche.normaliser(shortName(baseTitle, expansion.name()))));
    }

    /** "Catan: Seafarers" on the page of "Catan" reads "Seafarers": the page already names the game. */
    static String shortName(String baseTitle, String expansionName) {
        for (String separator : List.of(":", " – ", " - ")) {
            int at = expansionName.indexOf(separator);
            if (at > 0 && TexteRecherche.normaliser(expansionName.substring(0, at))
                    .equals(TexteRecherche.normaliser(baseTitle))) {
                String rest = expansionName.substring(at + separator.length()).trim();
                return rest.isEmpty() ? expansionName : rest;
            }
        }
        return expansionName;
    }

    @Override
    public boolean own(EntityType entityType, Entity work, WorkElement element) {
        if (!element.key().startsWith(KEY_PREFIX)) {
            return false;
        }
        if (element.linkedEntityId() != null) {
            acquisition.own(element.linkedEntityId(), null, null);
            return true;
        }
        String expansionId = element.key().substring(KEY_PREFIX.length());
        String bggId = bggIdOf(work.attributes());
        BoardGameExpansion expansion = bggId == null ? null : cache.findAll(Set.of(bggId)).values().stream()
                .flatMap(row -> row.expansions().stream())
                .filter(candidate -> candidate.bggId().equals(expansionId))
                .findFirst().orElse(null);
        if (expansion == null) {
            return false;
        }
        Map<String, Object> attributes = new LinkedHashMap<>();
        attributes.put(BGG_ID, expansion.bggId());
        if (expansion.imageUrl() != null) {
            attributes.put("coverImageUrl", expansion.imageUrl());
        }
        if (expansion.yearPublished() != null) {
            attributes.put("yearPublished", expansion.yearPublished());
        }
        acquisition.ownVariant(work.id(), shortName(work.title(), expansion.name()), attributes);
        return true;
    }

    /** The board games of the account: owned (active copy of the whole game) or wished, by BGG id and by name. */
    private AccountGames readAccount(EntityType type) {
        List<Ownership> active = ownershipRepository.findAll().stream().filter(Ownership::isActive).toList();
        List<WishlistEntry> wishes = wishlistEntryRepository.findAll();
        Set<UUID> ids = new HashSet<>();
        active.forEach(o -> ids.add(o.entityId()));
        wishes.forEach(w -> ids.add(w.entityId()));
        Map<String, Entity> byBggId = new HashMap<>();
        Map<String, Entity> byTitle = new HashMap<>();
        for (Entity entity : ids.isEmpty() ? List.<Entity>of() : entityRepository.findAllById(ids)) {
            if (!type.id().equals(entity.entityTypeId())) {
                continue;
            }
            Optional.ofNullable(bggIdOf(entity.attributes())).ifPresent(id -> byBggId.putIfAbsent(id, entity));
            byTitle.putIfAbsent(TexteRecherche.normaliser(entity.title()), entity);
        }
        Map<UUID, Ownership> owned = new HashMap<>();
        active.stream().filter(o -> o.variantId().isEmpty()).forEach(o -> owned.putIfAbsent(o.entityId(), o));
        Set<UUID> wished = new HashSet<>();
        wishes.stream().filter(w -> w.variantId().isEmpty()).forEach(w -> wished.add(w.entityId()));
        return new AccountGames(byBggId, byTitle, owned, wished);
    }

    record AccountGames(Map<String, Entity> byBggId, Map<String, Entity> byTitle, Map<UUID, Ownership> ownedCopies,
                        Set<UUID> wished) {

        static final AccountGames EMPTY = new AccountGames(Map.of(), Map.of(), Map.of(), Set.of());

        Optional<Entity> find(String bggId, String name) {
            return Optional.ofNullable(byBggId.get(bggId))
                    .or(() -> Optional.ofNullable(byTitle.get(TexteRecherche.normaliser(name))));
        }
    }

    static String bggIdOf(Map<String, Object> attributes) {
        return attributes == null ? null : BoardGameExpansionBackfill.textOf(attributes.get(BGG_ID));
    }
}
