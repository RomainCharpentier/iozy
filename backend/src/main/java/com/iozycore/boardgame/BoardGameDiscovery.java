package com.iozycore.boardgame;

import com.iozycore.boardgame.bgg.BggCollectionItem;
import com.iozycore.boardgame.bgg.BggHotListFetcher;
import com.iozycore.boardgame.bgg.BggThingFetcher;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.shared.TexteRecherche;
import com.iozycore.insights.DiscoveryCandidate;
import com.iozycore.insights.DiscoverySource;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Découvrir, pour les jeux de société : les jeux « tendance » de BGG (/hot)
 * qui partagent des catégories ou des mécaniques avec ceux qu'on possède -
 * la façade du module {@code boardgame} vers le cœur (Lot 133).
 *
 * <p>Limite assumée : seuls les jeux dont le bggId a été capturé (recherche,
 * ou import de collection BGG) sont examinés - un jeu ajouté à la main sans
 * passer par ces flux n'est pas pris en compte.
 */
@Component
public class BoardGameDiscovery implements DiscoverySource {

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
    public List<DiscoveryCandidate> discover(EntityType entityType) {
        List<Entity> ownedGames = entityRepository.findAllByType(entityType.id());
        List<String> ownedBggIds = ownedGames.stream()
                .map(e -> e.attributes().get("bggId"))
                .filter(id -> id instanceof String s && !s.isBlank())
                .map(Object::toString)
                .limit(MAX_OWNED_GAMES_EXAMINED)
                .toList();
        if (ownedBggIds.isEmpty()) {
            return List.of();
        }

        Map<String, Integer> favoriteCategoryFrequency = new HashMap<>();
        for (String bggId : ownedBggIds) {
            for (String category : bggThingFetcher.fetchCategoriesAndMechanics(bggId)) {
                favoriteCategoryFrequency.merge(category, 1, Integer::sum);
            }
        }
        if (favoriteCategoryFrequency.isEmpty()) {
            return List.of();
        }

        Set<String> ownedTitles = ownedGames.stream()
                .map(e -> TexteRecherche.normaliser(e.title()))
                .collect(Collectors.toSet());

        List<BggCollectionItem> hotGames = bggHotListFetcher.fetchHotBoardGames();
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
            Set<String> categories = bggThingFetcher.fetchCategoriesAndMechanics(hotGame.externalId());
            Set<String> shared = new HashSet<>(categories);
            shared.retainAll(favoriteCategoryFrequency.keySet());
            if (!shared.isEmpty()) {
                suggestions.add(new DiscoveryCandidate(
                        "BGG", hotGame.externalId(), hotGame.title(), null,
                        "En commun : " + String.join(", ", shared)));
            }
        }
        return suggestions;
    }
}
