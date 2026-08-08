package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityType;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Dérive, à partir des séries liées connues d'un candidat (voir
 * {@link RelatedSeriesProvider}), les fragments de titre à exclure de la
 * recherche de tomes (voir GoogleBooksVolumeSearchProvider) - un spin-off
 * publié sous un titre structurellement identique à un vrai nom de
 * collection ("Blue Lock - Episode Nagi - Tome 5") ne doit pas apparaître
 * comme une édition de la série cherchée.
 * <p>
 * Best-effort et volontairement limité (voir {@link #distinctiveSuffix}) :
 * ne fonctionne que quand le titre de la série liée partage un préfixe
 * textuel avec le titre d'origine - MyAnimeList indexe parfois un spin-off
 * sous son titre romaji d'origine, sans aucun lien textuel avec le titre
 * anglais/français utilisé pour la recherche de tomes (vérifié manuellement :
 * "Demon Slayer" -> spin-off "Kimetsu Gakuen!", aucun mot commun) - dans ce
 * cas, ce spin-off reste invisible à ce mécanisme, exactement comme avant.
 */
@Service
public class RelatedSeriesService {

    private final List<RelatedSeriesProvider> providers;
    // TTL long (comme frenchTitleCache/barcodeCache de MetadataSearchService) :
    // les relations d'une série changent rarement. Ne mémorise QUE le résultat
    // de l'appel externe, jamais indexé par le titre français cherché (une
    // même série malId peut être recherchée sous plusieurs titres/tomes).
    private final TtlCache<String, List<String>> cache = new TtlCache<>(Duration.ofHours(24), 500);

    public RelatedSeriesService(List<RelatedSeriesProvider> providers) {
        this.providers = providers;
    }

    /**
     * @param externalId   malId (ou équivalent) du candidat sélectionné, déjà
     *                     connu côté client au moment de la recherche de
     *                     tomes - vide si absent (candidat sans identifiant
     *                     exploitable, ex: scan ISBN).
     * @param originalTitle titre "d'origine" du candidat (voir
     *                      MetadataCandidate.title, avant toute résolution du
     *                      titre français) - sert de référence pour isoler la
     *                      partie distinctive d'un titre de série liée.
     */
    public List<String> findExcludedTitleFragments(EntityType entityType, String externalId, String originalTitle) {
        if (externalId == null || externalId.isBlank() || originalTitle == null || originalTitle.isBlank()) {
            return List.of();
        }
        String cacheKey = entityType.id() + "|" + externalId;
        return cache.get(cacheKey).orElseGet(() -> {
            List<String> relatedTitles = providers.stream()
                    .filter(provider -> provider.supports(entityType))
                    .flatMap(provider -> provider.findRelatedSeriesTitles(externalId).stream())
                    .collect(Collectors.toList());
            List<String> fragments = relatedTitles.stream()
                    .map(relatedTitle -> distinctiveSuffix(relatedTitle, originalTitle))
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.toList());
            cache.put(cacheKey, fragments);
            return fragments;
        });
    }

    /**
     * "Blue Lock: Episode Nagi" + "Blue Lock" -&gt; "Episode Nagi" - isole la
     * partie distinctive d'un titre de série liée par rapport au titre
     * d'origine. {@code null} si le titre lié ne partage même pas ce préfixe
     * (rien d'exploitable, voir javadoc de la classe) ou si le fragment
     * restant est trop court (&lt; 4 caractères) pour être comparé sans
     * risque de faux positif sur un mot générique (ex: le "re" de "Tokyo
     * Ghoul:re" - trop court et déjà documenté comme limite acceptée,
     * voir historique de la conversation).
     */
    private static String distinctiveSuffix(String relatedTitle, String originalTitle) {
        String lowerRelated = relatedTitle.toLowerCase();
        String trimmedOriginal = originalTitle.trim();
        if (!lowerRelated.startsWith(trimmedOriginal.toLowerCase())) {
            return null;
        }
        String suffix = relatedTitle.substring(trimmedOriginal.length())
                .replaceAll("^[\\s:\\-–,]+", "")
                .trim();
        return suffix.length() >= 4 ? suffix : null;
    }
}
