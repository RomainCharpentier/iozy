package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.insights.DiscoveryCandidate;
import com.iozycore.core.insights.DiscoverySource;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.core.metadata.TtlCache;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Découvrir, pour les mangas : d'autres œuvres du même mangaka que tes mangas
 * les mieux notés, en excluant ce que tu possèdes déjà - la façade du module
 * manga vers le cœur (Lot 133).
 *
 * <p>Tous les fournisseurs qui couvrent le manga sont essayés dans l'ordre,
 * pas seulement Jikan : la Recherche bascule sur MyAnimeList quand Jikan
 * flanche, et c'est précisément pour ça que ce relais existe (audit du
 * 2026-08-21 : Jikan répondait 504, le panneau Manga de Découvrir était vide
 * sans que rien ne le dise).
 *
 * <h2>Ce que la mesure à volume a trouvé (lot 141)</h2>
 * Sur 300 séries, ouvrir Découvrir coûtait <b>307 requêtes SQL</b> - une par
 * œuvre pour lire ses notes - et <b>deux secondes</b> chez les fournisseurs,
 * à chaque ouverture, pour trois recherches dont le résultat ne bouge
 * qu'avec les notes et la collection. Les notes se lisent désormais en une
 * requête, et les suggestions sont <b>retenues une demi-heure</b>, sous une
 * clé qui porte exactement ce dont elles dépendent : les mangaka favoris et
 * les titres possédés. Un résultat vide n'est pas retenu - un fournisseur qui
 * toussait ne doit pas laisser le panneau vide une demi-heure de plus.
 */
@Component
public class MangaDiscovery implements DiscoverySource {

    private static final int MAX_SUGGESTIONS = 8;
    private static final Duration RETENUE = Duration.ofMinutes(30);

    private final EntityRepository entityRepository;
    private final ExperienceRepository experienceRepository;
    private final List<MetadataProvider> metadataProviders;
    private final TtlCache<String, List<DiscoveryCandidate>> memoire = new TtlCache<>(RETENUE, 64);

    public MangaDiscovery(EntityRepository entityRepository, ExperienceRepository experienceRepository,
                          List<MetadataProvider> metadataProviders) {
        this.entityRepository = entityRepository;
        this.experienceRepository = experienceRepository;
        this.metadataProviders = metadataProviders;
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<DiscoveryCandidate> discover(EntityType mangaType) {
        List<Entity> ownedManga = entityRepository.findAllByType(mangaType.id());
        if (ownedManga.isEmpty()) {
            return List.of();
        }
        Set<String> ownedTitles = ownedManga.stream()
                .map(e -> TexteRecherche.normaliser(e.title()))
                .collect(Collectors.toSet());

        // Mangaka des œuvres les mieux notées, les mieux notées en premier,
        // sans doublon - c'est le signal de goût le plus direct qu'on ait.
        Map<UUID, Integer> meilleuresNotes = meilleuresNotesParOeuvre();
        List<String> favoriteMangaka = ownedManga.stream()
                .filter(entity -> meilleuresNotes.containsKey(entity.id()))
                .sorted(Comparator.comparing((Entity entity) -> meilleuresNotes.get(entity.id())).reversed())
                .map(entity -> entity.attributes().get("mangaka"))
                .filter(mangaka -> mangaka instanceof String s && !s.isBlank())
                .map(Object::toString)
                .distinct()
                .limit(3)
                .toList();

        String cle = favoriteMangaka + "|" + ownedTitles.hashCode();
        Optional<List<DiscoveryCandidate>> retenues = memoire.get(cle);
        if (retenues.isPresent()) {
            return retenues.get();
        }

        List<DiscoveryCandidate> suggestions = new ArrayList<>();
        for (String mangaka : favoriteMangaka) {
            for (MetadataCandidate candidate : searchWithFallback(mangaType, mangaka)) {
                if (suggestions.size() >= MAX_SUGGESTIONS) {
                    break;
                }
                if (ownedTitles.contains(TexteRecherche.normaliser(candidate.title()))) {
                    continue; // déjà dans la collection
                }
                suggestions.add(new DiscoveryCandidate(
                        candidate.source(), candidate.externalId(), candidate.title(), candidate.imageUrl(),
                        "Même auteur : " + mangaka));
            }
        }
        if (!suggestions.isEmpty()) {
            memoire.put(cle, List.copyOf(suggestions));
        }
        return suggestions;
    }

    /** La meilleure note de chaque œuvre, en UNE lecture - et non une par œuvre. */
    private Map<UUID, Integer> meilleuresNotesParOeuvre() {
        Map<UUID, Integer> notes = new HashMap<>();
        for (Experience experience : experienceRepository.findAll()) {
            experience.rating().ifPresent(note -> notes.merge(experience.entityId(), note, Math::max));
        }
        return notes;
    }

    /** Les fournisseurs qui couvrent ce type, dans l'ordre, et le premier résultat non vide. */
    private List<MetadataCandidate> searchWithFallback(EntityType entityType, String query) {
        for (MetadataProvider provider : metadataProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            List<MetadataCandidate> results = provider.search(query);
            if (!results.isEmpty()) {
                return results;
            }
        }
        return List.of();
    }
}
