package com.iozycore.boardgame;

import com.iozycore.boardgame.bgg.BggCollectionItem;
import com.iozycore.boardgame.bgg.BggHotListFetcher;
import com.iozycore.boardgame.bgg.BggThingFetcher;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.insights.Discovery;
import com.iozycore.core.insights.Discovery.EmptyReason;
import com.iozycore.core.insights.DiscoveryCandidate;
import com.iozycore.core.insights.DiscoverySource;
import com.iozycore.core.metadata.SourceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Discover, for board games: the "trending" BGG games (/hot)
 * that share categories or mechanics with the ones the user owns -
 * the facade of the {@code boardgame} module towards the core (Batch 133).
 *
 * <p>Accepted limit: only games whose bggId was captured (search,
 * or BGG collection import) are examined - a game added by hand without
 * going through these flows is not taken into account.
 *
 * <p>BGG is asked several times (the categories of each owned game, the hot
 * list, the categories of each hot game). A call with no answer is skipped,
 * and the result says the source was silent (batch 159). Without the hot list
 * or without any category of the owned games, nothing can be suggested at all.
 */
@Component
public class BoardGameDiscovery implements DiscoverySource {

    private static final Logger log = LoggerFactory.getLogger(BoardGameDiscovery.class);
    private static final int MAX_OWNED_GAMES_EXAMINED = 5;
    private static final int MAX_HOT_GAMES_EXAMINED = 12;
    private static final int MAX_SUGGESTIONS = 8;

    private final EntityRepository entityRepository;
    private final BggThingFetcher bggThingFetcher;
    private final BggHotListFetcher bggHotListFetcher;

    public BoardGameDiscovery(EntityRepository entityRepository, BggThingFetcher bggThingFetcher,
                              BggHotListFetcher bggHotListFetcher) {
        this.entityRepository = entityRepository;
        this.bggThingFetcher = bggThingFetcher;
        this.bggHotListFetcher = bggHotListFetcher;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "BOARD_GAME".equals(entityType.code());
    }

    @Override
    public Discovery discover(EntityType entityType) {
        List<Entity> ownedGames = entityRepository.findAllByType(entityType.id());
        if (ownedGames.isEmpty()) {
            return Discovery.nothingToAsk(EmptyReason.NOTHING_OWNED);
        }
        List<String> ownedBggIds = ownedGames.stream()
                .map(e -> e.attributes().get("bggId"))
                .filter(id -> id instanceof String s && !s.isBlank())
                .map(Object::toString)
                .limit(MAX_OWNED_GAMES_EXAMINED)
                .toList();
        if (ownedBggIds.isEmpty()) {
            return Discovery.nothingToAsk(EmptyReason.NOT_LINKED_TO_SOURCE);
        }

        boolean allCallsAnswered = true;
        Map<String, Integer> favoriteCategoryFrequency = new HashMap<>();
        for (String bggId : ownedBggIds) {
            Optional<Set<String>> categories = categoriesOf(bggId);
            if (categories.isEmpty()) {
                allCallsAnswered = false;
                continue;
            }
            for (String category : categories.get()) {
                favoriteCategoryFrequency.merge(category, 1, Integer::sum);
            }
        }
        if (favoriteCategoryFrequency.isEmpty()) {
            return Discovery.asked(List.of(), allCallsAnswered);
        }

        Set<String> ownedTitles = ownedGames.stream()
                .map(e -> TexteRecherche.normaliser(e.title()))
                .collect(Collectors.toSet());

        List<BggCollectionItem> hotGames;
        try {
            hotGames = bggHotListFetcher.fetchHotBoardGames();
        } catch (SourceUnavailableException e) {
            log.warn("Discover: {}", e.getMessage());
            return Discovery.asked(List.of(), false);
        }
        List<DiscoveryCandidate> suggestions = new ArrayList<>();
        int examined = 0;
        for (BggCollectionItem hotGame : hotGames) {
            if (examined >= MAX_HOT_GAMES_EXAMINED || suggestions.size() >= MAX_SUGGESTIONS) {
                break;
            }
            if (ownedTitles.contains(TexteRecherche.normaliser(hotGame.title()))) {
                continue;
            }
            examined++;
            Optional<Set<String>> categories = categoriesOf(hotGame.externalId());
            if (categories.isEmpty()) {
                allCallsAnswered = false;
                continue;
            }
            Set<String> shared = new HashSet<>(categories.get());
            shared.retainAll(favoriteCategoryFrequency.keySet());
            if (!shared.isEmpty()) {
                suggestions.add(new DiscoveryCandidate(
                        "BGG", hotGame.externalId(), hotGame.title(), null,
                        "En commun : " + String.join(", ", shared)));
            }
        }
        return Discovery.asked(suggestions, allCallsAnswered);
    }

    /** The categories and mechanics of a game, empty when BGG did not answer. */
    private Optional<Set<String>> categoriesOf(String bggId) {
        try {
            return Optional.of(bggThingFetcher.fetchCategoriesAndMechanics(bggId));
        } catch (SourceUnavailableException e) {
            log.warn("Discover: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
