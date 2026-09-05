package com.iozycore.videogame;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.shared.TexteRecherche;
import com.iozycore.insights.DiscoveryCandidate;
import com.iozycore.insights.DiscoverySource;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.videogame.igdb.IgdbSimilarGamesFetcher;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Découvrir, pour les jeux vidéo : des jeux similaires à ceux qu'on possède,
 * tels qu'IGDB les relie - la façade du module {@code videogame} vers le
 * cœur (Lot 133).
 *
 * <p>Plus simple que les jeux de société : IGDB expose la similarité
 * directement par jeu, pas besoin de croiser catégories et mécaniques via un
 * second signal. Même limite assumée : seuls les jeux dont l'igdbId a été
 * capturé (ajoutés par la recherche) sont examinés - un jeu ajouté à la main
 * n'est pas pris en compte.
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
                    continue; // déjà dans la collection
                }
                suggestions.add(new DiscoveryCandidate(
                        "IGDB", similar.externalId(), similar.title(), similar.imageUrl(),
                        "Similaire à un jeu que tu possèdes"));
            }
        }
        return suggestions;
    }
}
