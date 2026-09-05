package com.iozycore.manga.metadata;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.core.metadata.TtlCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Le titre de l'édition FRANÇAISE d'un manga - un geste qui n'a de sens que
 * pour cet univers (extrait de MetadataSearchService au Lot 132).
 * <p>
 * Les fournisseurs de mangas rendent un titre original ou romaji ; c'est le
 * titre sous lequel la série est vendue en France qu'il faut afficher et
 * chercher ensuite (tomes, éditions). Open Library puis Google Books le
 * connaissent ; les gardes-fous ci-dessous évitent qu'un titre trouvé par le
 * seul nom de l'auteur ne soit en fait celui d'une AUTRE œuvre - ce que les
 * fournisseurs qui cataloguent les titres originaux (voir
 * {@link MetadataProvider#catalogsOriginalTitles}) permettent de vérifier.
 * <p>
 * frenchTitleCache ne mémorise QUE les résultats trouvés (jamais une
 * absence) : un échec réseau transitoire ne doit pas condamner le même titre
 * à échouer pendant 24 h.
 */
@Service
public class FrenchTitleService {

    private static final Logger log = LoggerFactory.getLogger(FrenchTitleService.class);

    private final List<MetadataProvider> providers;
    private final List<FrenchTitleProvider> frenchTitleProviders;
    private final TtlCache<String, String> frenchTitleCache = new TtlCache<>(Duration.ofHours(24), 500);

    public FrenchTitleService(List<MetadataProvider> providers, List<FrenchTitleProvider> frenchTitleProviders) {
        this.providers = providers;
        this.frenchTitleProviders = frenchTitleProviders;
    }

    /** La cle de comparaison des titres - accents et ponctuation plies, comme la recherche locale (voir TexteRecherche). */
    private static String normalize(String value) {
        return TexteRecherche.normaliser(value);
    }

    /**
     * Recherche best-effort d'un titre d'édition française (voir
     * OpenLibraryFrenchTitleProvider, essayé en premier, puis
     * GoogleBooksFrenchTitleProvider en repli) - déclenchée uniquement quand
     * l'utilisateur choisit une suggestion (jamais pour toute une liste de
     * résultats de recherche), pour limiter les appels externes. Vide si le
     * type n'est pas couvert ou si aucun fournisseur n'a rien trouvé.
     *
     * @param author mangaka, si connu (voir MetadataCandidate.attributes) -
     *               améliore nettement la précision (voir OpenLibraryFrenchTitleProvider).
     */
    public Optional<String> findFrenchTitle(EntityType entityType, String query, String author) {
        return findFrenchTitle(entityType, query, author, List.of());
    }

    /** Variante avec exclusion de suites/spin-offs connus (voir RelatedSeriesService) -
     * ex: "Dragon Ball Super nº 18" résolu à tort comme titre français de
     * "Dragon Ball" (sa suite étant beaucoup mieux référencée sur Open
     * Library, vérifié manuellement, voir historique de la conversation). */
    public Optional<String> findFrenchTitle(EntityType entityType, String query, String author, List<String> excludedTitleFragments) {
        return findFrenchTitle(entityType, query, author, excludedTitleFragments, null);
    }

    /**
     * @param externalId identifiant de la série cherchée chez la source qui
     *                   l'a proposée (malId, voir MetadataCandidate) - sert
     *                   uniquement à reconnaître la série elle-même parmi les
     *                   œuvres cataloguées quand un titre trouvé par le seul
     *                   nom de l'auteur est vérifié (voir
     *                   {@link #namesAnotherKnownWork}). Best-effort, sans
     *                   effet si absent : la comparaison retombe alors sur
     *                   les titres.
     */
    public Optional<String> findFrenchTitle(EntityType entityType, String query, String author,
                                             List<String> excludedTitleFragments, String externalId) {
        String cacheKey = entityType.id() + "|" + normalize(query) + "|" + normalize(author == null ? "" : author);
        Optional<String> cached = frenchTitleCache.get(cacheKey);
        if (cached.isPresent()) {
            return cached;
        }

        Optional<String> result = resolveFrenchTitle(entityType, query, author, excludedTitleFragments, externalId);
        result.ifPresent(title -> frenchTitleCache.put(cacheKey, title));
        return result;
    }

    /**
     * Arbitre entre fournisseurs par la VALEUR DE PREUVE du résultat, pas par
     * leur ordre (voir {@link FrenchTitleMatch.Confidence}) : une
     * correspondance sur la série cherchée est retenue immédiatement, tandis
     * qu'une trouvaille "auteur seul" est mise de côté le temps de laisser
     * les fournisseurs suivants proposer mieux - sans quoi le premier
     * fournisseur (Open Library) impose sa supposition alors que le suivant
     * (Google Books) connaît parfois la vraie réponse. Coût : un appel
     * externe de plus dans ce seul cas, resté rare (un fournisseur ne
     * descend à son dernier recours que quand rien du titre cherché n'a
     * matché).
     */
    private Optional<String> resolveFrenchTitle(EntityType entityType, String query, String author,
                                                 List<String> excludedTitleFragments, String externalId) {
        String authorOnlyTitle = null;
        for (FrenchTitleProvider provider : frenchTitleProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            Optional<FrenchTitleMatch> match = provider.findFrenchTitle(query, author, excludedTitleFragments);
            if (match.isEmpty()) {
                continue;
            }
            FrenchTitleMatch found = match.get();
            if (found.confidence() == FrenchTitleMatch.Confidence.SERIES_MATCHED) {
                return Optional.of(found.title());
            }
            if (authorOnlyTitle == null) {
                authorOnlyTitle = found.title();
            }
        }
        if (authorOnlyTitle == null || namesAnotherKnownWork(entityType, authorOnlyTitle, query, externalId)) {
            return Optional.empty();
        }
        return Optional.of(authorOnlyTitle);
    }

    /**
     * Vrai si {@code candidateTitle} est LUI-MÊME le titre catalogué d'une
     * AUTRE œuvre que celle cherchée - une édition française traduite n'est
     * par nature référencée nulle part sous ce titre côté catalogue japonais
     * (MyAnimeList/Jikan), alors qu'une autre œuvre du même auteur y est
     * évidemment référencée sous le sien. C'est ce qui sépare les deux
     * résultats "auteur seul" possibles, vérifié en direct sur ces deux cas
     * réels (voir historique de la conversation) :
     * <ul>
     *   <li>"Vagabond" (Takehiko Inoue) donnait "Slam Dunk" - catalogué tel
     *   quel sous un autre malId : c'est son autre manga, pas une traduction.
     *   Le titre français réel de Vagabond étant "Vagabond", ne rien
     *   retourner laisse le client garder le titre déjà affiché, ce qui est
     *   ici exactement la bonne réponse ;</li>
     *   <li>"Zom 100" (Haro Aso) donne "Bucket List of the Dead", son vrai
     *   titre français - le catalogue ne connaît que "Zom 100: Bucket List of
     *   the Dead", titre DIFFÉRENT (la comparaison est une égalité exacte,
     *   jamais un contains(), sans quoi ce cas serait écarté à tort).</li>
     * </ul>
     * Vérification impossible (panne/quota du catalogue) = résultat écarté :
     * une supposition non corroborée vaut moins qu'un 404 honnête, le client
     * gardant alors le titre original déjà affiché plutôt que de se voir
     * imposer le titre d'une autre série (jaquettes et tomes suivraient).
     * <p>
     * N'interroge QUE les fournisseurs qui cataloguent sous le titre
     * d'origine (voir {@link MetadataProvider#catalogsOriginalTitles()}) :
     * inclure celui qui cherche par titre français reviendrait à faire
     * écarter tous les vrais titres français, puisqu'il les trouve
     * justement - c'est toute la logique de cette vérification qui
     * s'inverserait.
     */
    private boolean namesAnotherKnownWork(EntityType entityType, String candidateTitle, String query, String externalId) {
        List<MetadataCandidate> catalogued;
        try {
            catalogued = providers.stream()
                    .filter(provider -> provider.supports(entityType) && provider.catalogsOriginalTitles())
                    .flatMap(provider -> provider.search(candidateTitle).stream())
                    .collect(Collectors.toList());
        } catch (RuntimeException e) {
            log.warn("Titre français '{}' (trouvé par le seul nom de l'auteur) écarté : catalogue non joignable pour le vérifier - {}",
                    candidateTitle, e.getMessage());
            return true;
        }
        for (MetadataCandidate candidate : catalogued) {
            if (!hasTitle(candidate, candidateTitle) || isQueriedSeries(candidate, query, externalId)) {
                continue;
            }
            log.info("Titre français '{}' (trouvé par le seul nom de l'auteur) écarté : c'est le titre catalogué de '{}' ({}), une autre œuvre",
                    candidateTitle, candidate.title(), candidate.externalId());
            return true;
        }
        return false;
    }

    private static boolean isQueriedSeries(MetadataCandidate candidate, String query, String externalId) {
        if (externalId != null && !externalId.isBlank() && externalId.equals(candidate.externalId())) {
            return true;
        }
        // Repli quand l'identifiant est inconnu, ou vient d'une autre source
        // que celle qui a répondu ici (deux identifiants ne sont comparables
        // qu'au sein d'une même source) : le titre original cherché suffit à
        // reconnaître la série - "Vagabond" catalogué sous "Vagabond" EST
        // bien la série cherchée, pas une autre œuvre.
        return hasTitle(candidate, query);
    }

    /** Égalité exacte (insensible à la casse) avec l'un des titres connus du
     * candidat - titre principal ET titres alternatifs (voir
     * MyAnimeListMetadataProvider : titleRomaji/titleEnglish/titleJapanese),
     * un même manga étant catalogué sous plusieurs formes. */
    private static boolean hasTitle(MetadataCandidate candidate, String title) {
        if (title == null || title.isBlank()) {
            return false;
        }
        String normalized = normalize(title);
        if (normalize(candidate.title()).equals(normalized)) {
            return true;
        }
        for (String key : List.of("titleRomaji", "titleEnglish", "titleJapanese")) {
            Object value = candidate.attributes().get(key);
            if (value instanceof String alternative && !alternative.isBlank() && normalize(alternative).equals(normalized)) {
                return true;
            }
        }
        return false;
    }
}
