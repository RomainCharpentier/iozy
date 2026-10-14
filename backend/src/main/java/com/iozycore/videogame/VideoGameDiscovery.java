package com.iozycore.videogame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.insights.Discovery;
import com.iozycore.core.insights.Discovery.EmptyReason;
import com.iozycore.core.insights.DiscoveryCandidate;
import com.iozycore.core.insights.DiscoverySource;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.videogame.igdb.IgdbSimilarGamesFetcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Discover, for video games: games similar to the ones the user owns,
 * as IGDB links them - the facade of the {@code videogame} module towards the
 * core (Batch 133).
 *
 * <p>Simpler than board games: IGDB exposes similarity
 * directly per game, no need to cross categories and mechanics through a
 * second signal. Same accepted limit: only games whose igdbId was
 * captured (added through search) are examined - a game added by hand
 * is not taken into account.
 *
 * <p>A game whose similar games IGDB did not send is skipped, and the result
 * says the source was silent (batch 159): the panel then offers to try again
 * instead of saying there is nothing to offer.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class VideoGameDiscovery implements DiscoverySource {

    private static final int MAX_OWNED_GAMES_EXAMINED = 5;
    private static final int MAX_SUGGESTIONS = 8;

    private final EntityRepository entityRepository;
    private final IgdbSimilarGamesFetcher igdbSimilarGamesFetcher;

    @Override
    public boolean supports(EntityType entityType) {
        return "VIDEO_GAME".equals(entityType.code());
    }

    @Override
    public Discovery discover(EntityType entityType) {
        List<Entity> ownedGames = entityRepository.findAllByType(entityType.id());
        if (ownedGames.isEmpty()) {
            return Discovery.nothingToAsk(EmptyReason.NOTHING_OWNED);
        }
        List<String> ownedIgdbIds = ownedGames.stream()
                .map(e -> e.attributes().get("igdbId"))
                .filter(id -> id instanceof String s && !s.isBlank())
                .map(Object::toString)
                .limit(MAX_OWNED_GAMES_EXAMINED)
                .toList();
        if (ownedIgdbIds.isEmpty()) {
            return Discovery.nothingToAsk(EmptyReason.NOT_LINKED_TO_SOURCE);
        }

        Set<String> ownedTitles = ownedGames.stream()
                .map(e -> TexteRecherche.normaliser(e.title()))
                .collect(Collectors.toSet());

        List<DiscoveryCandidate> suggestions = new ArrayList<>();
        boolean allCallsAnswered = true;
        for (String igdbId : ownedIgdbIds) {
            List<MetadataCandidate> similarGames;
            try {
                similarGames = igdbSimilarGamesFetcher.fetchSimilarGames(igdbId);
            } catch (SourceUnavailableException e) {
                log.warn("Discover: {}", e.getMessage());
                allCallsAnswered = false;
                continue;
            }
            for (MetadataCandidate similar : similarGames) {
                if (suggestions.size() >= MAX_SUGGESTIONS) {
                    break;
                }
                if (ownedTitles.contains(TexteRecherche.normaliser(similar.title()))) {
                    continue; // already in the collection
                }
                suggestions.add(new DiscoveryCandidate(
                        "IGDB", similar.externalId(), similar.title(), similar.imageUrl(),
                        "Similaire à un jeu que tu possèdes"));
            }
        }
        return Discovery.asked(suggestions, allCallsAnswered);
    }
}
