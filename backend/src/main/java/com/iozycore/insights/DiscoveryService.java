package com.iozycore.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.shared.TexteRecherche;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataProvider;
import org.springframework.stereotype.Service;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Découverte heuristique ("séries que je n'ai pas", recommandations) -
 * jamais un vrai moteur de recommandation IA (cohérent avec le principe
 * "l'IA est une aide, jamais une dépendance" posé dès la conception).
 * Chaque suggestion est justifiée par un signal concret et traçable :
 * même auteur pour les mangas (Jikan) ; les autres univers apportent le
 * leur par DiscoverySource.
 */
@Service
public class DiscoveryService {

    private static final int MAX_OWNED_GAMES_EXAMINED = 5;
    private static final int MAX_SUGGESTIONS = 8;

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final ExperienceRepository experienceRepository;
    /** TOUS les fournisseurs qui couvrent le manga, pas seulement Jikan : voir mangaProvidersSearch. */
    private final List<MetadataProvider> metadataProviders;
    /** Les univers qui ont leur propre signal de découverte (Lot 133) - le cœur ne les connaît pas. */
    private final List<DiscoverySource> sources;

    public DiscoveryService(EntityRepository entityRepository,
                             EntityTypeRepository entityTypeRepository,
                             ExperienceRepository experienceRepository,
                             List<MetadataProvider> metadataProviders,
                             List<DiscoverySource> sources) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.experienceRepository = experienceRepository;
        this.metadataProviders = metadataProviders;
        this.sources = sources;
    }

    /** Résout l'id du type par son code bien connu - reste volontairement câblé sur le code
     * (pas sur un id hardcodé) pour continuer à fonctionner même si le label/schema du type
     * a été édité via l'éditeur de types ; renvoie null si ce type a été supprimé. */
    private UUID resolveTypeId(String code) {
        return entityTypeRepository.findByCode(code).map(EntityType::id).orElse(null);
    }

    /**
     * Autres œuvres du même mangaka que tes mangas les mieux notés, en
     * excluant ce que tu possèdes déjà.
     */
    public List<DiscoveryCandidate> discoverManga() {
        Optional<EntityType> mangaType = entityTypeRepository.findByCode("MANGA");
        if (mangaType.isEmpty()) {
            return List.of();
        }
        UUID mangaTypeId = mangaType.get().id();
        List<Entity> ownedManga = entityRepository.findAllByType(mangaTypeId);
        if (ownedManga.isEmpty()) {
            return List.of();
        }

        Set<String> ownedTitlesLower = ownedManga.stream()
                .map(e -> TexteRecherche.normaliser(e.title()))
                .collect(Collectors.toSet());

        // Mangaka des œuvres les mieux notées, les mieux notées en premier,
        // sans doublon - c'est le signal de goût le plus direct qu'on ait.
        List<String> favoriteMangaka = ownedManga.stream()
                .map(entity -> new AbstractMap.SimpleEntry<>(entity, bestRatingFor(entity.id())))
                .filter(entry -> entry.getValue() != null)
                .sorted(Comparator.comparing((AbstractMap.SimpleEntry<Entity, Integer> entry) -> entry.getValue())
                        .reversed())
                .map(entry -> entry.getKey().attributes().get("mangaka"))
                .filter(mangaka -> mangaka instanceof String s && !s.isBlank())
                .map(Object::toString)
                .distinct()
                .limit(3)
                .toList();

        List<DiscoveryCandidate> suggestions = new ArrayList<>();
        for (String mangaka : favoriteMangaka) {
            List<MetadataCandidate> results = searchWithFallback(mangaType.get(), mangaka);
            for (MetadataCandidate candidate : results) {
                if (suggestions.size() >= MAX_SUGGESTIONS) {
                    break;
                }
                if (ownedTitlesLower.contains(TexteRecherche.normaliser(candidate.title()))) {
                    continue; // déjà dans la collection
                }
                suggestions.add(new DiscoveryCandidate(
                        candidate.source(), candidate.externalId(), candidate.title(), candidate.imageUrl(),
                        "Même auteur : " + mangaka));
            }
        }
        return suggestions;
    }



    /**
     * Les découvertes d'un type, par son code. Le manga vit encore ici ; les
     * autres univers s'inscrivent par {@link DiscoverySource} - jeux vidéo et
     * jeux de société depuis le Lot 133. Un code inconnu, ou un type que
     * personne ne couvre, est une demande qu'on ne sait pas servir.
     */
    public List<DiscoveryCandidate> discover(String entityTypeCode) {
        return switch (entityTypeCode) {
            case "MANGA" -> discoverManga();
            default -> entityTypeRepository.findByCode(entityTypeCode)
                    .flatMap(type -> sources.stream()
                            .filter(source -> source.supports(type))
                            .findFirst()
                            .map(source -> source.discover(type)))
                    .orElseThrow(() -> new IllegalArgumentException("Aucune découverte pour le type : " + entityTypeCode));
        };
    }

    private Integer bestRatingFor(UUID entityId) {
        return experienceRepository.findByEntityId(entityId).stream()
                .map(Experience::rating)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    /**
     * Interroge les fournisseurs qui couvrent ce type, dans l'ordre, et rend le
     * premier résultat non vide.
     * <p>
     * Découvrir appelait Jikan EN DUR, alors que la Recherche, elle, reçoit la
     * liste complète des fournisseurs et bascule sur MyAnimeList quand Jikan
     * flanche - or c'est précisément pour ça que ce relais a été ajouté :
     * MyAnimeList bloque/throttle Jikan par intermittence. Constaté en direct
     * (audit du 2026-08-21) : Jikan répondait 504 sur "Takeshi Obata", et le
     * panneau Manga de Découvrir était donc vide, sans que rien ne le dise -
     * une panne externe présentée comme une absence de suggestions.
     */
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
