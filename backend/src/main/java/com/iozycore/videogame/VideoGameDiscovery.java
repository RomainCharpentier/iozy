package com.iozycore.videogame;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.insights.DiscoveryCandidate;
import com.iozycore.core.insights.DiscoverySource;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.videogame.igdb.IgdbSimilarGamesFetcher;
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
 */
@Component
public class VideoGameDiscovery implements DiscoverySource {

    private static final int MAX_OWNED_GAMES_EXAMINED = 5;
    private static final int MAX_SUGGESTIONS = 8;

    private final EntityRepository entityRepository;
    private final IgdbSimilarGamesFetcher igdbSimilarGamesFetcher;

    public VideoGameDiscovery(EntityRepository entityRepository, IgdbSimilarGamesFetcher igdbSimilarGamesFetcher) {
        this.entityRepository = entityRepository;
        this.igdbSimilarGamesFetcher = igdbSimilarGamesFetcher;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "VIDEO_GAME".equals(entityType.code());
    }

    @Override
    public List<DiscoveryCandidate> discover(EntityType entityType) {
        List<Entity> ownedGames = entityRepository.findAllByType(entityType.id());
        List<String> ownedIgdbIds = ownedGames.stream()
                .map(e -> e.attributes().get("igdbId"))
                .filter(id -> id instanceof String s && !s.isBlank())
                .map(Object::toString)
                .limit(MAX_OWNED_GAMES_EXAMINED)
                .toList();
        if (ownedIgdbIds.isEmpty()) {
            return List.of();
        }

        Set<String> ownedTitles = ownedGames.stream()
                .map(e -> TexteRecherche.normaliser(e.title()))
                .collect(Collectors.toSet());

        List<DiscoveryCandidate> suggestions = new ArrayList<>();
        for (String igdbId : ownedIgdbIds) {
            for (MetadataCandidate similar : igdbSimilarGamesFetcher.fetchSimilarGames(igdbId)) {
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
        return suggestions;
    }
}
