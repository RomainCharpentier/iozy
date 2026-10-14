package com.iozycore.manga;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.insights.Discovery;
import com.iozycore.core.insights.Discovery.EmptyReason;
import com.iozycore.core.insights.DiscoveryCandidate;
import com.iozycore.core.insights.DiscoverySource;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.core.metadata.QuotaExceededException;
import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.core.metadata.TtlCache;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
 * Discover, for mangas: other works by the same mangaka as your
 * best rated mangas, excluding what you already own - the facade of the
 * manga module towards the core (Batch 133).
 *
 * <p>All the providers that cover manga are tried in order,
 * not only Jikan: Search falls back to MyAnimeList when Jikan
 * fails, and this is exactly why this relay exists (audit of
 * 2026-08-21: Jikan answered 504, the Manga panel of Discover was empty
 * and nothing said so).
 *
 * <h2>What the measure at volume found (batch 141)</h2>
 * On 300 series, opening Discover cost <b>307 SQL queries</b> - one per
 * work to read its ratings - and <b>two seconds</b> at the providers,
 * at every opening, for three searches whose result only changes
 * with the ratings and the collection. Ratings are now read in one
 * query, and the suggestions are <b>kept for half an hour</b>, under a
 * key that carries exactly what they depend on: the favourite mangaka and
 * the owned titles. An empty result is not kept - a provider that
 * was coughing must not leave the panel empty for another half hour.
 *
 * <h2>Silent or empty: the panel is told which (batch 159)</h2>
 * Each provider is asked through {@link MetadataProvider#searchOrThrow}, so an
 * outage is not read as "no other work by this author". A search counts as
 * answered when one provider answered, even with nothing. If one search got
 * no answer at all, the result says the source was silent and is not kept:
 * a partial list must not hide the missing author for half an hour.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MangaDiscovery implements DiscoverySource {

    private static final int MAX_SUGGESTIONS = 8;
    private static final Duration RETENUE = Duration.ofMinutes(30);

    private final EntityRepository entityRepository;
    private final ExperienceRepository experienceRepository;
    private final List<MetadataProvider> metadataProviders;
    private final TtlCache<String, Discovery> memoire = new TtlCache<>(RETENUE, 64);

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public Discovery discover(EntityType mangaType) {
        List<Entity> ownedManga = entityRepository.findAllByType(mangaType.id());
        if (ownedManga.isEmpty()) {
            return Discovery.nothingToAsk(EmptyReason.NOTHING_OWNED);
        }
        Set<String> ownedTitles = ownedManga.stream()
                .map(e -> TexteRecherche.normaliser(e.title()))
                .collect(Collectors.toSet());

        // Mangaka of the best rated works, best rated first,
        // without duplicates - this is the most direct taste signal we have.
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
        if (favoriteMangaka.isEmpty()) {
            boolean anyRated = ownedManga.stream().anyMatch(entity -> meilleuresNotes.containsKey(entity.id()));
            return Discovery.nothingToAsk(anyRated ? EmptyReason.NO_KNOWN_AUTHOR : EmptyReason.NO_RATED_WORK);
        }

        String cle = favoriteMangaka + "|" + ownedTitles.hashCode();
        Optional<Discovery> retenue = memoire.get(cle);
        if (retenue.isPresent()) {
            return retenue.get();
        }

        List<DiscoveryCandidate> suggestions = new ArrayList<>();
        boolean allSearchesAnswered = true;
        for (String mangaka : favoriteMangaka) {
            Optional<List<MetadataCandidate>> answer = searchWithFallback(mangaType, mangaka);
            if (answer.isEmpty()) {
                allSearchesAnswered = false;
                continue;
            }
            for (MetadataCandidate candidate : answer.get()) {
                if (suggestions.size() >= MAX_SUGGESTIONS) {
                    break;
                }
                if (ownedTitles.contains(TexteRecherche.normaliser(candidate.title()))) {
                    continue; // already in the collection
                }
                suggestions.add(new DiscoveryCandidate(
                        candidate.source(), candidate.externalId(), candidate.title(), candidate.imageUrl(),
                        "Même auteur : " + mangaka));
            }
        }
        Discovery discovery = Discovery.asked(suggestions, allSearchesAnswered);
        if (allSearchesAnswered && !suggestions.isEmpty()) {
            memoire.put(cle, discovery);
        }
        return discovery;
    }

    /** The best rating of each work, in ONE read - and not one per work. */
    private Map<UUID, Integer> meilleuresNotesParOeuvre() {
        Map<UUID, Integer> notes = new HashMap<>();
        for (Experience experience : experienceRepository.findAll()) {
            experience.rating().ifPresent(note -> notes.merge(experience.entityId(), note, Math::max));
        }
        return notes;
    }

    /**
     * The providers that cover this type, in order, and the first non-empty
     * result. Empty when no provider answered at all; an empty list when one
     * answered and none found anything.
     */
    private Optional<List<MetadataCandidate>> searchWithFallback(EntityType entityType, String query) {
        boolean answered = false;
        for (MetadataProvider provider : metadataProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            try {
                List<MetadataCandidate> results = provider.searchOrThrow(query);
                answered = true;
                if (!results.isEmpty()) {
                    return Optional.of(results);
                }
            } catch (SourceUnavailableException | QuotaExceededException e) {
                log.warn("Discover: no answer from a manga provider for '{}': {}", query, e.getMessage());
            }
        }
        return answered ? Optional.of(List.of()) : Optional.empty();
    }
}
