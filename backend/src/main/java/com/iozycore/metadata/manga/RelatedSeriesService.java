package com.iozycore.metadata.manga;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.TtlCache;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

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
 * textuel avec au moins un des titres "d'origine" essayés (voir
 * {@code originalTitleCandidates} de {@link #findExcludedTitleFragments}) -
 * MyAnimeList indexe un spin-off tantôt sous le titre romaji d'origine de la
 * série, tantôt sous une variante ne partageant aucun lien textuel avec
 * AUCUN des titres connus (vérifié manuellement : "Demon Slayer"/"Kimetsu no
 * Yaiba" -> spin-off "Kimetsu Gakuen!", aucun préfixe commun avec l'un ou
 * l'autre) - dans ce dernier cas, ce spin-off reste invisible à ce
 * mécanisme, quel que soit le nombre de candidats essayés.
 * <p>
 * Cas réel qui motive l'essai de PLUSIEURS candidats plutôt qu'un seul
 * (signalé en testant "Attack on Titan", voir historique) : le titre retenu
 * côté client est le titre anglais ("Attack on Titan"), mais MyAnimeList
 * indexe son spin-off "Before the Fall" sous le titre romaji de la série
 * ("Shingeki no Kyojin: Before the Fall") - aucun lien avec "Attack on
 * Titan", mais un préfixe exact avec "Shingeki no Kyojin" (voir
 * MyAnimeListMetadataProvider.titleRomaji, déjà connu du candidat côté
 * client).
 */
@Service
public class RelatedSeriesService {

    private final List<RelatedSeriesProvider> providers;
    // TTL long (comme barcodeCache de MetadataSearchService, frenchTitleCache de FrenchTitleService) :
    // les relations d'une série changent rarement. Mémorise les titres BRUTS
    // des séries liées (résultat de l'appel externe), PAS les fragments déjà
    // dérivés - ces derniers dépendent des titres d'origine essayés, qui
    // peuvent varier d'un appel à l'autre pour un même externalId (ex: un
    // appel qui ne connaît pas encore le titre romaji) ; jamais indexé par le
    // titre français cherché (une même série malId peut être recherchée sous
    // plusieurs titres/tomes).
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
        return findExcludedTitleFragments(entityType, externalId, originalTitle, null);
    }

    /**
     * Variante qui essaie un second titre "d'origine" (voir javadoc de la
     * classe) - typiquement {@code titleRomaji} (voir
     * MyAnimeListMetadataProvider), en repli quand {@code originalTitle}
     * (le titre anglais/affiché) ne partage aucun préfixe avec le titre lié.
     *
     * @param titleRomaji second candidat, {@code null}/vide si inconnu ou
     *                    identique à {@code originalTitle} (pas de perte si
     *                    absent, juste moins de spin-offs détectés).
     */
    public List<String> findExcludedTitleFragments(EntityType entityType, String externalId, String originalTitle, String titleRomaji) {
        List<String> originalTitleCandidates = Stream.of(originalTitle, titleRomaji)
                .filter(candidate -> candidate != null && !candidate.isBlank())
                .distinct()
                .collect(Collectors.toList());
        if (externalId == null || externalId.isBlank() || originalTitleCandidates.isEmpty()) {
            return List.of();
        }
        String cacheKey = entityType.id() + "|" + externalId;
        List<String> relatedTitles = cache.get(cacheKey).orElseGet(() -> {
            List<String> fetched = providers.stream()
                    .filter(provider -> provider.supports(entityType))
                    .flatMap(provider -> provider.findRelatedSeriesTitles(externalId).stream())
                    .collect(Collectors.toList());
            cache.put(cacheKey, fetched);
            return fetched;
        });
        return relatedTitles.stream()
                .map(relatedTitle -> distinctiveSuffix(relatedTitle, originalTitleCandidates))
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    /** Essaie chaque candidat dans l'ordre, garde le premier suffixe trouvé
     * (voir javadoc de la classe) - l'ordre n'a pas d'importance en pratique,
     * un titre lié ne partage normalement un préfixe qu'avec AU PLUS un des
     * candidats (des titres d'origine distincts, ex: anglais vs romaji). */
    private static String distinctiveSuffix(String relatedTitle, List<String> originalTitleCandidates) {
        for (String originalTitle : originalTitleCandidates) {
            String suffix = distinctiveSuffix(relatedTitle, originalTitle);
            if (suffix != null) {
                return suffix;
            }
        }
        return null;
    }

    /**
     * "Blue Lock: Episode Nagi" + "Blue Lock" -&gt; "Episode Nagi" - isole la
     * partie distinctive d'un titre de série liée par rapport au titre
     * d'origine. {@code null} si le titre lié ne partage même pas ce préfixe
     * (rien d'exploitable, voir javadoc de la classe) ou si le fragment
     * restant est trop court pour être comparé sans risque de faux positif
     * sur un mot générique - seuil de 4 caractères, ABAISSÉ à 2 dans deux cas
     * (voir {@link #isAllUppercaseAcronym}/{@link #isGluedColonSuffix}) où le
     * risque de faux positif est bien plus faible qu'un mot générique isolé,
     * la comparaison finale restant de toute façon un match par mot ENTIER
     * (voir GoogleBooksVolumeSearchProvider.matchesKnownRelatedSeries) :
     * <ul>
     *   <li>un suffixe entièrement en MAJUSCULES (ex: "SD") - cas réel qui
     *   motive cet assouplissement (signalé directement par l'utilisateur en
     *   testant "Dragon Ball", voir historique) : "Dragon Ball SD" (parodie
     *   chibi, taguée "alternative_version" sur MyAnimeList) donne le
     *   suffixe "SD" (2 caractères) - sans cet assouplissement, le seuil de
     *   4 l'excluait silencieusement, rendant inopérant l'ajout de
     *   "alternative_version" à MyAnimeListRelatedSeriesProvider
     *   .DISTINCT_SERIES_RELATIONS pour ce cas précis malgré une relation
     *   correctement remontée par l'API ;</li>
     *   <li>un suffixe collé à un ":" SANS espace (ex: "re" dans "Tokyo
     *   Ghoul:re") - cas réel qui motive ce second assouplissement (trouvé
     *   en continuant les tests sur "Tokyo Ghoul", voir historique) : "Tokyo
     *   Ghoul:re" (tagué "sequel", une suite avec sa propre histoire) donne
     *   le suffixe "re", 2 caractères ET minuscule - sans cet
     *   assouplissement, il ressortait comme une édition nommée "Re" avec
     *   ses 10 tomes. Un ":" collé sans espace est une stylisation de titre
     *   caractéristique d'une continuation ("X:re", ".hack//...") - bien
     *   plus distinctif qu'un simple mot générique comme "re" isolé (ex:
     *   "Blue Lock: Episode Nagi", ":" SUIVI d'un espace, reste soumis au
     *   seuil de 4 comme avant).</li>
     * </ul>
     * Seuil ABAISSÉ à 1 seul caractère quand les DEUX assouplissements
     * s'appliquent À LA FOIS (sigle majuscule ET collé à un ":") - cas réel
     * qui motive ce dernier palier (trouvé en continuant les tests sur
     * "Gantz", voir historique) : "Gantz:E" (tagué "alternative_setting",
     * un spin-off à l'univers alternatif) donne le suffixe "E", une SEULE
     * lettre - ni l'un ni l'autre assouplissement seul (seuil 2) ne suffit,
     * mais leur combinaison est un signal encore plus distinctif que
     * chacun pris isolément.
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
        boolean isAcronym = isAllUppercaseAcronym(suffix);
        boolean isGluedColon = isGluedColonSuffix(relatedTitle, trimmedOriginal);
        int minLength = isAcronym && isGluedColon ? 1 : (isAcronym || isGluedColon ? 2 : 4);
        return suffix.length() >= minLength ? suffix : null;
    }

    /** Vrai si {@code suffix} ne contient aucune lettre minuscule (ex: "SD",
     * "GT") ET au moins une lettre (un suffixe purement numérique/ponctuation
     * n'est pas un sigle) - voir {@link #distinctiveSuffix}. */
    private static boolean isAllUppercaseAcronym(String suffix) {
        boolean hasLetter = false;
        for (int i = 0; i < suffix.length(); i++) {
            char c = suffix.charAt(i);
            if (Character.isLetter(c)) {
                hasLetter = true;
                if (Character.isLowerCase(c)) {
                    return false;
                }
            }
        }
        return hasLetter;
    }

    /** Vrai si le caractère juste après le titre d'origine est un ":" LUI-MÊME
     * suivi d'un caractère non-espace (ex: "Tokyo Ghoul:re") - voir
     * {@link #distinctiveSuffix}. Un ":" suivi d'un espace ("Blue Lock:
     * Episode Nagi") ne compte volontairement pas : cette stylisation
     * annonce d'ordinaire un sous-titre descriptif classique, pas une
     * continuation stylisée. */
    private static boolean isGluedColonSuffix(String relatedTitle, String trimmedOriginal) {
        int afterOriginal = trimmedOriginal.length();
        return relatedTitle.length() > afterOriginal + 1
                && relatedTitle.charAt(afterOriginal) == ':'
                && !Character.isWhitespace(relatedTitle.charAt(afterOriginal + 1));
    }
}
