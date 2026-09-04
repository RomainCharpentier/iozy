package com.iozycore.metadata.googlebooks;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.metadata.QuotaExceededException;
import com.iozycore.metadata.SourceUnavailableException;
import com.iozycore.metadata.VolumeCandidate;
import com.iozycore.metadata.VolumeSearchProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalInt;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Recherche les tomes réels (avec jaquette) des éditions françaises d'une
 * série de manga via Google Books.
 * <p>
 * Une seule requête {@code intitle:}+{@code inauthor:} générique s'est avérée
 * insuffisante en pratique (vérifié manuellement, voir historique de la
 * conversation) : Google Books classe les résultats par pertinence/popularité,
 * pas par exhaustivité éditoriale - pour "Dragon Ball", la requête générique
 * (même paginée sur 120 résultats) ne renvoie QUE la "Perfect Edition",
 * l'édition originale n'apparaissant jamais dans les 40/80/120 premiers
 * résultats. Il n'existe pas d'équivalent gratuit au catalogue édité à la
 * main de Mangacollec.
 * <p>
 * Palliatif : une requête par mot-clé d'édition française courante, lancées
 * en parallèle ({@link CompletableFuture}) plutôt qu'en série pour ne pas
 * cumuler leurs latences - chacune cible une édition précise, ce qui
 * contourne le biais de popularité de la requête générique. Résultat fusionné
 * et dédoublonné une seule fois à la fin (pas édition par édition : un même
 * tome peut apparaître dans plusieurs requêtes, ex: la requête vide ET la
 * requête "perfect edition" peuvent toutes deux remonter un tome Perfect
 * Edition). Reste best-effort : une édition absente de tous ces mots-clés
 * (nom de collection inhabituel) restera invisible.
 * <p>
 * Coût en quota externe non négligeable (une requête par mot-clé) : scindé
 * en {@link #QUICK_EDITION_KEYWORDS} (3, lancés à chaque recherche - couvre
 * la grande majorité des mangas, qui n'ont aucune édition spéciale) et
 * {@link #DEEP_EDITION_KEYWORDS} (5, lancés uniquement à la demande via
 * {@link #searchAdditionalEditions}, voir bouton "Chercher plus d'éditions"
 * côté client) - vérifié manuellement (voir historique de la conversation) :
 * lancer systématiquement les 8 mots-clés a été le plus gros poste de
 * consommation de quota de toute l'application.
 */
@Component
// Derriere la BnF (Lot 119) : un quota journalier, huit requetes par
// recherche, et des editions devinees dans un titre libre. Reste
// indispensable pour les jaquettes, que la BnF n'a pas.
@Order(2)
public class GoogleBooksVolumeSearchProvider implements VolumeSearchProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleBooksVolumeSearchProvider.class);
    private static final String SEARCH_URL =
            "https://www.googleapis.com/books/v1/volumes?q=%s&langRestrict=fr&maxResults=40";

    // Lancés automatiquement à CHAQUE recherche (searchVolumes) - "" couvre
    // l'édition de base/simple (ne porte généralement aucun suffixe dans son
    // propre titre), "perfect edition"/"edition originale" sont les deux
    // types d'édition spéciale les plus demandés du marché manga francophone
    // et ceux qui ont concrètement motivé la recherche par mots-clés cette
    // session (Dragon Ball Perfect Edition, One Piece Édition Originale -
    // absents des 120 premiers résultats d'une requête générique, voir
    // javadoc de la classe). La grande majorité des mangas n'ont aucune
    // édition spéciale : ces 3 requêtes suffisent à couvrir leur cas, au
    // lieu de payer les 8 mots-clés à chaque fois (vérifié manuellement,
    // voir historique de la conversation - c'est le plus gros poste de
    // consommation de quota de toute l'application).
    private static final List<String> QUICK_EDITION_KEYWORDS = List.of("", "perfect edition", "edition originale");

    // Lancés uniquement à la demande (voir searchAdditionalEditions, bouton
    // "Chercher plus d'éditions" côté client) - types d'édition plus rares,
    // surtout pertinents pour les grandes franchises à rééditions multiples
    // (Naruto Star Edition, coffrets/intégrales, éditions collector...).
    private static final List<String> DEEP_EDITION_KEYWORDS = List.of(
            "star edition", "ultimate edition", "deluxe", "intégrale", "collector",
            // Format francais courant (Ki-oon, Pika...) : deux tomes en un.
            // Signale sur « Doubt » (Lot 123), publie en 4 tomes simples et
            // 2 tomes doubles - aucun mot-cle ne le cherchait.
            "édition double");

    // "Tome 5", "Vol. 12", "T.3", "T04" (forme abrégée sans point, courante
    // sur Google Books - ex: "Fragments d'elles T04", vérifié manuellement)
    // - capture le numéro. \b devant "t" évite de confondre avec un simple
    // "t" en fin d'un autre mot ; le mot-clé exigé (jamais juste un nombre en
    // fin de titre) évite de confondre avec une année ou un numéro de chapitre.
    private static final Pattern VOLUME_NUMBER = Pattern.compile("(?i)\\b(?:tome|vol\\.?|t\\.?)\\s*0*(\\d+)");
    // "One Piece édition originale - Chapitre 648" - vente à l'unité d'un
    // chapitre numérique, jamais un vrai tome physique : à exclure même si un
    // numéro de tome apparaît ailleurs dans une fiche voisine du même résultat.
    private static final Pattern CHAPTER_KEYWORD = Pattern.compile("(?i)\\bchapitre\\b|\\bchapter\\b");
    // « Doubt Tome 1 à 4 », « Naruto tomes 1-3 » : un coffret, pas un tome.
    // Sans cette garde, la sonde du tome 1 (Lot 125) le prenait pour un
    // tome 1 d'une edition nommee « 4 » (Lot 126).
    private static final Pattern RANGE_KEYWORD = Pattern.compile("(?i)\\btomes?\\s*\\d+\\s*(?:à|a|-|–)\\s*\\d+\\b");
    // "." ajouté (vérifié manuellement, voir historique) : "Chainsaw Man
    // Tome 18 . Edition collector" a son numéro de tome AVANT le nom de
    // collection, séparé par un point - sans lui, l'édition extraite
    // restait ". Edition collector" (point résiduel non nettoyé).
    // "()" ajoutés (vérifié manuellement, voir historique) : "Yu-Gi-Oh !
    // (Intégrale) - Tome 1" a son nom de collection entre parenthèses - sans
    // eux dans cette classe, l'édition extraite restait "(Intégrale)" au
    // lieu de "Intégrale".
    private static final Pattern LEADING_TRAILING_SEPARATORS = Pattern.compile("^[\\s\\-–:,.()]+|[\\s\\-–:,.()]+$");
    // "L'Attaque des Titans - L'intégrale T01 à T04" (coffret regroupant 4
    // tomes, vérifié manuellement) : VOLUME_NUMBER retire bien "T01" ET "T04"
    // (deux numéros dans le même titre), mais le connecteur "à" entre les
    // deux reste seul au milieu du texte restant - ni en tête ni en fin, donc
    // pas nettoyé par LEADING_TRAILING_SEPARATORS - et se retrouve capitalisé
    // en "À" par capitalizeWords : "L'intégrale à" -> "L'intégrale À".
    // (?U) indispensable ici : \b est basé par défaut sur \w ASCII (Java), qui
    // ne considère PAS "à" comme un caractère de mot - entouré d'espaces des
    // deux côtés (deux non-mots), \bà\b sans (?U) ne matche jamais (aucune
    // transition mot/non-mot détectée). (?U) rend \w Unicode-aware.
    private static final Pattern DANGLING_RANGE_CONNECTOR = Pattern.compile("(?iU)\\bà\\b");

    private final GoogleBooksHttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public GoogleBooksVolumeSearchProvider(GoogleBooksHttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /** Constructeur utilisé par les tests unitaires : parse()/extractCandidates()
     * n'appellent jamais httpClient - seul searchVolumes() en a besoin, jamais
     * exercé dans ces tests qui passent directement un corps de réponse déjà
     * en mémoire. */
    GoogleBooksVolumeSearchProvider() {
        this(new GoogleBooksHttpClient("", ""));
    }

    @Override
    public boolean supports(EntityType entityType) {
        return "MANGA".equals(entityType.code());
    }

    @Override
    public List<VolumeCandidate> searchVolumes(String seriesTitle, String author, List<String> excludedTitleFragments) {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            return List.of();
        }

        // Quota probablement encore épuisé sur toutes les clés (voir
        // GoogleBooksHttpClient.isQuotaLikelyExhausted) : un seul appel (le
        // mot-clé de base) plutôt que 3, pour ne pas gaspiller en échecs
        // quasi certains la capacité qui ne fait que commencer à revenir.
        List<String> keywordsToTry = httpClient.isQuotaLikelyExhausted() ? List.of("") : QUICK_EDITION_KEYWORDS;
        return runKeywordSearches(seriesTitle, author, keywordsToTry, excludedTitleFragments);
    }

    @Override
    public List<VolumeCandidate> searchAdditionalEditions(String seriesTitle, String author, List<String> excludedTitleFragments) {
        if (seriesTitle == null || seriesTitle.isBlank()) {
            return List.of();
        }
        // Action volontaire et déjà coûteuse par nature (5 requêtes) : si le
        // quota est probablement encore épuisé, ne pas les gaspiller en
        // échecs quasi certains - échoue tout de suite plutôt qu'en silence.
        if (httpClient.isQuotaLikelyExhausted()) {
            throw new QuotaExceededException(
                    "Quota Google Books probablement encore épuisé - recherche approfondie ignorée pour '" + seriesTitle + "'");
        }
        return runKeywordSearches(seriesTitle, author, DEEP_EDITION_KEYWORDS, excludedTitleFragments);
    }

    private List<VolumeCandidate> runKeywordSearches(String seriesTitle, String author, List<String> keywords, List<String> excludedTitleFragments) {
        AtomicBoolean anyQuotaExceeded = new AtomicBoolean(false);
        AtomicBoolean anySourceUnavailable = new AtomicBoolean(false);
        List<CompletableFuture<List<VolumeCandidate>>> searches = keywords.stream()
                .map(keyword -> CompletableFuture.supplyAsync(
                        () -> searchOneEdition(seriesTitle, author, keyword, excludedTitleFragments, anyQuotaExceeded, anySourceUnavailable)))
                .collect(Collectors.toList());

        List<VolumeCandidate> combined = searches.stream()
                .flatMap(future -> future.join().stream())
                .collect(Collectors.toList());

        List<VolumeCandidate> result = mergeAndFinalize(combined);

        // Une liste vide peut être une absence réelle d'édition française, ou
        // le quota Google Books dépassé sur l'ensemble des requêtes - les
        // distinguer permet à MetadataSearchService de le signaler
        // explicitement plutôt que de laisser croire à tort "aucune édition
        // trouvée" (voir historique de la conversation).
        if (result.isEmpty() && anyQuotaExceeded.get()) {
            throw new QuotaExceededException("Quota Google Books dépassé pour la recherche de tomes de '" + seriesTitle + "'");
        }
        // Même raisonnement pour une source qui n'a pas répondu du tout (503,
        // délai dépassé) : c'était le défaut du Lot 58 - « Aucune trouvée cette
        // fois. » affiché, et la liste vide mise en cache durablement, alors que
        // le tome existait chez le fournisseur.
        if (result.isEmpty() && anySourceUnavailable.get()) {
            throw new SourceUnavailableException("Google Books n'a pas répondu pour la recherche de tomes de '" + seriesTitle + "'");
        }
        return result;
    }

    /**
     * Étape commune à {@link #runKeywordSearches} (production, N requêtes
     * HTTP réelles) et aux tests de régression de cette classe (fixtures
     * déjà en mémoire, une par mot-clé simulé) : dédoublonnage, résolution
     * one-shot, puis filtre anti-bruit - dans cet ordre précis, voir
     * chacune des méthodes appelées pour le détail. Package-private (pas
     * {@code private}) exactement pour cette raison : reproduire fidèlement
     * l'enchaînement complet des étapes est ce qui a révélé l'interaction
     * cachée entre deux bugs indépendants sur "Sword Art Online" (voir
     * historique) - invisible en testant chaque étape isolément.
     */
    static List<VolumeCandidate> mergeAndFinalize(List<VolumeCandidate> combined) {
        List<VolumeCandidate> deduped = dedupeAndSort(combined);
        // filterOutNoiseEditions suppose des éditions multi-tomes (voir sa
        // javadoc) - jamais applicable à un one-shot résolu par
        // resolveOneShotFallback, qui n'a par nature qu'UN seul exemplaire
        // par édition.
        boolean isProbableOneShot = !deduped.isEmpty() && deduped.stream().allMatch(candidate -> candidate.volumeNumber() == 0);
        return isProbableOneShot
                ? resolveOneShotFallback(deduped)
                : filterOutNoiseEditions(resolveOneShotFallback(deduped));
    }

    /**
     * 0 (voir {@code candidates.add} dans {@link #extractCandidates}) marque
     * un titre nu sans "Tome N" - un one-shot probable ("Re/member",
     * "Hideout", vérifiés manuellement, voir historique) puisqu'un manga
     * complet en un seul tome n'a par nature aucune raison d'être numéroté.
     * <p>
     * Ne se déclenche QUE si absolument TOUS les candidats du lot sont dans
     * ce cas - un mélange de tomes numérotés et de titres nus indique une
     * vraie série multi-tomes mal couverte (le titre nu y est alors du bruit,
     * ex: une fiche incomplète du même tome déjà vu ailleurs avec son
     * numéro), jamais un one-shot : dans ce cas, les titres nus sont
     * simplement écartés, jamais promus.
     */
    private static List<VolumeCandidate> resolveOneShotFallback(List<VolumeCandidate> candidates) {
        if (candidates.isEmpty() || candidates.stream().anyMatch(candidate -> candidate.volumeNumber() > 0)) {
            return candidates.stream().filter(candidate -> candidate.volumeNumber() > 0).collect(Collectors.toList());
        }
        return candidates.stream()
                .map(candidate -> new VolumeCandidate(candidate.edition(), 1, candidate.imageUrl(), candidate.title()))
                .collect(Collectors.toList());
    }

    /** Une "édition" à un seul tome ressort presque toujours d'un faux positif
     * de la recherche plein-texte (ex: "One Piece Party", un dérivé qui
     * contient le titre de la série sans en être une édition) plutôt que
     * d'une vraie petite collection - on l'écarte, MAIS seulement s'il existe
     * par ailleurs au moins une édition solidement représentée (2+ tomes) :
     * sans ce "groupe témoin", rien ne permet de distinguer un faux positif
     * isolé d'une couverture simplement clairsemée sur TOUTES les éditions
     * trouvées à la fois (voir cas réel ci-dessous) - dans ce dernier cas,
     * mieux vaut les montrer toutes que de tout écarter.
     * <p>
     * Cas réel qui motive cet assouplissement (signalé en testant "Sword Art
     * Online", voir historique) : les arcs "Aincrad", "Progressive" et
     * "Ordinal Scale" ne ressortent chacun qu'avec UN SEUL tome trouvé
     * (limite de couverture Google Books sur cette série, pas un faux
     * positif) - avant cet assouplissement, countByEdition.size() &gt; 1
     * (trois éditions distinctes) déclenchait le filtre et écartait les
     * TROIS, alors qu'aucune n'était du bruit : la série entière ne
     * remontait alors AUCUN résultat.
     * <p>
     * Jamais appliqué à un one-shot déjà résolu par
     * {@link #resolveOneShotFallback} : un one-shot n'a par nature qu'UN
     * seul exemplaire par édition (jamais 2+, contrairement à une vraie
     * série multi-tomes), cette heuristique le prendrait sinon toujours à
     * tort pour du bruit. Package-private (pas {@code private}) : testé
     * directement, {@link #parse(String, String)} (utilisé par le reste des
     * tests de cette classe) ne représente qu'UNE requête/mot-clé et n'y
     * fait volontairement pas appel - ce filtre n'a de sens qu'après fusion
     * de TOUTES les requêtes (voir runKeywordSearches). */
    static List<VolumeCandidate> filterOutNoiseEditions(List<VolumeCandidate> candidates) {
        Map<String, Long> countByEdition = candidates.stream()
                .collect(Collectors.groupingBy(VolumeCandidate::edition, Collectors.counting()));
        boolean anyMultiVolumeEdition = countByEdition.values().stream().anyMatch(count -> count >= 2);
        if (countByEdition.size() <= 1 || !anyMultiVolumeEdition) {
            return candidates;
        }
        return candidates.stream()
                .filter(candidate -> countByEdition.get(candidate.edition()) >= 2)
                .collect(Collectors.toList());
    }

    private List<VolumeCandidate> searchOneEdition(String seriesTitle, String author, String editionKeyword,
                                                  List<String> excludedTitleFragments,
                                                  AtomicBoolean anyQuotaExceeded, AtomicBoolean anySourceUnavailable) {
        // Volontairement SANS inauthor: DANS LA REQUÊTE (vérifié
        // manuellement à trois reprises, voir historique) : certaines
        // fiches françaises n'ont pas le champ auteur correctement
        // renseigné - combiner intitle: et inauthor: peut alors éliminer
        // une bonne partie voire la quasi-totalité des résultats français,
        // au profit d'éditions dans d'autres langues qui prennent leur
        // place dans les résultats (constaté sur "Haikyu!!" : 0 résultat
        // exploitable au lieu de 15+ ; "Golden Kamui" : 1 au lieu de 6 ;
        // "Komi cherche ses mots" : 2 au lieu de 14). isRealPrefixMatch + la
        // vérification de langue déjà en place suffisent à écarter la
        // plupart des résultats non pertinents sans ce filtre à la requête.
        // {@code author} reste néanmoins transmis à extractCandidates pour
        // un filtre plus prudent EN SORTIE (authorMismatch) - voir sa
        // javadoc : rejeter un résultat seulement quand Google Books liste
        // explicitement un auteur qui n'a AUCUN rapport, jamais l'absence
        // d'auteur, contrairement à inauthor: qui aurait exclu la requête
        // entière dans ce cas.
        String combinedQuery = "intitle:" + seriesTitle
                + (editionKeyword.isBlank() ? "" : " " + editionKeyword);

        try {
            String encodedQuery = URLEncoder.encode(combinedQuery, StandardCharsets.UTF_8);
            String body = httpClient.get(SEARCH_URL.formatted(encodedQuery));
            return extractCandidates(body, seriesTitle, excludedTitleFragments, author);
        } catch (SourceUnavailableException e) {
            // Ne PAS relancer ici non plus : les autres mots-clés ont peut-être
            // abouti, eux - c'est runKeywordSearches qui tranche, une fois tout
            // rassemblé (voir le commentaire du quota juste en dessous).
            anySourceUnavailable.set(true);
            log.warn("Google Books n'a pas répondu pour la recherche de tomes '{}' : {}", combinedQuery, e.getMessage());
            return List.of();
        } catch (QuotaExceededException e) {
            // Ne PAS relancer ici : les 7 autres mots-clés (même quota
            // épuisé) vont échouer pareil - on note juste le fait, agrégé
            // ensuite par searchVolumes pour décider s'il faut le signaler.
            anyQuotaExceeded.set(true);
            log.warn("Quota Google Books dépassé pour la recherche de tomes '{}'", combinedQuery);
            return List.of();
        } catch (Exception e) {
            log.warn("Échec de la recherche de tomes Google Books pour '{}' : {}", combinedQuery, e.getMessage());
            return List.of();
        }
    }

    /** Miroir de {@link #searchOneEdition} pour les tests - parse une seule réponse
     * (édition/tome dédoublonnés) sans passer par les 8 requêtes en parallèle. */
    List<VolumeCandidate> parse(String body, String seriesTitle) throws Exception {
        return parse(body, seriesTitle, List.of());
    }

    /** Variante avec exclusion de spin-offs connus (voir RelatedSeriesService) -
     * séparée de {@link #parse(String, String)} pour ne pas casser les tests
     * existants qui n'en ont pas besoin. */
    List<VolumeCandidate> parse(String body, String seriesTitle, List<String> excludedTitleFragments) throws Exception {
        return parse(body, seriesTitle, excludedTitleFragments, null);
    }

    /** Variante avec vérification d'auteur (voir {@link #authorMismatch}) -
     * séparée de {@link #parse(String, String, List)} pour ne pas casser les
     * tests existants qui n'en ont pas besoin ({@code author} null =
     * vérification désactivée, comme si l'appelant ne le connaissait pas). */
    List<VolumeCandidate> parse(String body, String seriesTitle, List<String> excludedTitleFragments, String author) throws Exception {
        return resolveOneShotFallback(dedupeAndSort(extractCandidates(body, seriesTitle, excludedTitleFragments, author)));
    }

    /** Extrait les candidats bruts d'une réponse Google Books, SANS dédoublonner -
     * le dédoublonnage se fait une seule fois, après fusion de toutes les requêtes
     * (voir searchVolumes), pour ne jamais préférer arbitrairement le résultat
     * d'une requête sur une autre avant d'avoir vu l'ensemble. Package-private
     * (pas {@code private}) : appelée directement par les tests de régression
     * de cette classe pour simuler PLUSIEURS réponses (une par mot-clé) avant
     * de les fusionner via {@link #mergeAndFinalize}, sans dépendre du réseau. */
    List<VolumeCandidate> extractCandidates(String body, String seriesTitle, List<String> excludedTitleFragments, String author) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        List<VolumeCandidate> candidates = new java.util.ArrayList<>();

        for (JsonNode item : root.path("items")) {
            JsonNode volumeInfo = item.path("volumeInfo");
            if (!"fr".equals(volumeInfo.path("language").asText(null))) {
                continue; // langRestrict est une préférence, pas une garantie - on revérifie
            }
            String title = volumeInfo.path("title").asText(null);
            if (title == null || title.isBlank() || CHAPTER_KEYWORD.matcher(title).find()
                    || RANGE_KEYWORD.matcher(title).find()) {
                continue;
            }
            // La recherche plein-texte matche parfois une série DIFFÉRENTE qui
            // mentionne juste la série cherchée dans un titre plus long (ex:
            // "Boruto - Naruto Next Generations - Tome 3" remonté pour une
            // recherche "Naruto" - Boruto est un spin-off, pas une édition de
            // Naruto). Exiger que le titre commence bien par la série cherchée
            // écarte ces faux positifs sans dépendre d'une liste de noms de
            // séries dérivées à maintenir à la main.
            //
            // Un simple startsWith ne suffit pas : "Tokyo Ghoul:re Tome 5"
            // (vérifié manuellement, voir historique) commence bien par
            // "Tokyo Ghoul" mais ":re" est une suite/série à part sur
            // MyAnimeList, pas une édition de Tokyo Ghoul - contrairement à
            // un vrai nom de collection ("One Piece - Édition originale",
            // "Dragon Ball perfect edition"...), toujours séparé du titre de
            // la série par un espace. On exige donc que le préfixe soit suivi
            // d'un espace (ou de la fin de la chaîne), jamais collé
            // directement à d'autres lettres.
            //
            // matchSeriesPrefix (pas un simple startsWith) tolère en plus des
            // différences d'espaces/tirets À L'INTÉRIEUR du préfixe lui-même -
            // cas réels observés (voir historique) : le titre MyAnimeList
            // "One Punch Man" (espace) ne matchait pas "ONE-PUNCH MAN - tome
            // 18" (tiret) côté Google Books, et "Haikyu!!" (aucun espace) ne
            // matchait pas "Haikyu !! - Les As du volley T10" (espace avant
            // "!!") - deux mangas très connus, entièrement invisibles à la
            // recherche de tomes à cause de cette seule rigidité.
            String trimmedTitle = title.trim();
            int prefixEnd = matchSeriesPrefix(trimmedTitle, seriesTitle.trim());
            boolean isRealPrefixMatch = prefixEnd >= 0
                    && (prefixEnd == trimmedTitle.length() || Character.isWhitespace(trimmedTitle.charAt(prefixEnd)));
            if (!isRealPrefixMatch) {
                continue;
            }
            // Un titre de série COURT/générique (ex: "Monster", "Vagabond")
            // peut être le préfixe EXACT d'une œuvre totalement différente
            // (ex: "Monster Allergy Next Gen", une BD italienne sans aucun
            // rapport avec le "Monster" de Naoki Urasawa - vérifié
            // manuellement, voir historique) - le préfixe seul ne suffit
            // alors plus à confirmer qu'il s'agit de la même œuvre.
            if (authorMismatch(volumeInfo, author)) {
                continue;
            }
            // Spin-off/side-story CONNU (voir RelatedSeriesService, dérivé des
            // relations MyAnimeList) : même structurellement identique à un
            // vrai nom de collection ("Série - Spin-off - Tome N"), vérifié
            // manuellement sur "Blue Lock - Episode Nagi" et "Demon Slayer
            // School Days" (voir historique) - startsWith seul ne peut pas
            // les distinguer d'une vraie édition, contrairement à cette
            // information externe.
            if (matchesKnownRelatedSeries(trimmedTitle, excludedTitleFragments)) {
                continue;
            }
            OptionalInt volumeNumber = extractVolumeNumber(trimmedTitle, prefixEnd);

            // Alias historique entre parenthèses collé au titre de série
            // (ex: "City Hunter (Nicky Larson)", nom de l'adaptation
            // française historique) - à ne jamais confondre avec un vrai nom
            // d'édition entre parenthèses ("Yu-Gi-Oh ! (Intégrale)") qui,
            // lui, doit être conservé (voir skipLeadingAliasNotResemblingAnEdition).
            int editionStart = skipLeadingAliasNotResemblingAnEdition(trimmedTitle, prefixEnd);

            // "Re/member", "Hideout" (vérifiés manuellement, voir historique) :
            // un one-shot (manga complet en un seul tome) n'a par nature aucun
            // "Tome N" dans son titre - le titre brut EST alors exactement le
            // titre de la série, rien de plus. À ne pas confondre avec un
            // "Death Note Complete Box Set" (coffret) ou un artbook, qui n'ont
            // pas de numéro de tome NON PLUS mais laissent du texte
            // descriptif après le titre de série - seul un titre nu (rien
            // après le préfixe reconnu) est un candidat one-shot valable ;
            // runKeywordSearches décide ensuite, une fois TOUS les résultats
            // vus, si c'en est vraiment un (voir resolveOneShotFallback).
            boolean isBareTitleMention = editionStart == trimmedTitle.length();
            if (volumeNumber.isEmpty() && !isBareTitleMention) {
                continue; // coffret, artbook... sans numéro exploitable et pas juste le titre nu
            }

            String publisher = volumeInfo.path("publisher").asText(null);
            String edition = extractEdition(trimmedTitle, editionStart, seriesTitle, publisher);

            String imageUrl = volumeInfo.path("imageLinks").path("thumbnail").asText(null);
            if (imageUrl != null) {
                imageUrl = imageUrl.replaceFirst("^http://", "https://");
            }

            // 0 = numéro de tome non extrait (voir isBareTitleMention
            // ci-dessus) - sentinelle résolue par resolveOneShotFallback,
            // jamais renvoyée telle quelle à l'appelant.
            candidates.add(new VolumeCandidate(edition, volumeNumber.orElse(0), imageUrl, title,
                    isbn13(volumeInfo), annee(volumeInfo)));
        }
        return candidates;
    }

    /** L'ISBN-13 parmi les identifiants de la fiche, ou null. */
    private static String isbn13(JsonNode volumeInfo) {
        for (JsonNode id : volumeInfo.path("industryIdentifiers")) {
            if ("ISBN_13".equals(id.path("type").asText(""))) {
                return id.path("identifier").asText(null);
            }
        }
        return null;
    }

    /** « 2009 », « 2010-02-04 » : les quatre premiers chiffres, ou null. */
    private static Integer annee(JsonNode volumeInfo) {
        String date = volumeInfo.path("publishedDate").asText(null);
        if (date == null || date.length() < 4) {
            return null;
        }
        try {
            return Integer.parseInt(date.substring(0, 4));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * La sonde tome par tome (Lot 125) - idee empruntee, apres mesure, au
     * projet MangaCollector : {@code intitle:<serie> intitle:"Tome N"} au
     * lieu d'un mot-cle d'edition. Sur un titre court et courant, la
     * difference est brutale : « Doubt » rend 300 fiches (essais anglophones
     * sur le doute) a la recherche par titre, dont aucun tome exploitable ;
     * la sonde du tome 1 en rend 4, la bonne en tete, avec son ISBN.
     *
     * <p>Un piege propre a ces fiches : Google Books indexe souvent les tomes
     * francais sous le seul titre de la serie (« Doubt », sans numero) - le
     * numero est dans ses champs a lui, pas dans le titre. La recherche par
     * titre les jetait donc (numero introuvable). Ici, on SAIT quel numero on
     * a demande : une fiche au titre nu qui repond a « Tome N » et porte un
     * ISBN est le tome N. L'ISBN est exige : sans lui, rien ne distingue une
     * telle fiche de la page de la serie entiere, qui repondrait a tout.
     *
     * @throws QuotaExceededException quand la cle est a bout - l'appelant
     *         arrete de sonder et ne met rien en cache
     */
    @Override
    public List<VolumeCandidate> probeVolume(String seriesTitle, String author, int volumeNumber,
                                             List<String> excludedTitleFragments) {
        String query = "intitle:" + seriesTitle + " intitle:\"Tome " + volumeNumber + "\"";
        try {
            String body = httpClient.get(SEARCH_URL.formatted(URLEncoder.encode(query, StandardCharsets.UTF_8)));
            List<VolumeCandidate> trouves = new java.util.ArrayList<>();
            for (VolumeCandidate candidate : extractCandidates(body, seriesTitle, excludedTitleFragments, author)) {
                if (candidate.volumeNumber() == volumeNumber) {
                    trouves.add(candidate);
                } else if (candidate.volumeNumber() == 0 && candidate.isbnNormalise() != null) {
                    trouves.add(new VolumeCandidate(candidate.edition(), volumeNumber, candidate.imageUrl(),
                            candidate.title(), candidate.isbn(), candidate.annee()));
                }
            }
            return trouves;
        } catch (QuotaExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Échec de la sonde Google Books '{}' : {}", query, e.getMessage());
            throw new SourceUnavailableException("Google Books n'a pas répondu à la sonde du tome " + volumeNumber);
        }
    }

    /**
     * Vrai préfixe "flou" : avance en parallèle dans {@code title} et
     * {@code seriesTitle}, en sautant indépendamment les espaces/tirets de
     * CHAQUE côté avant de comparer le caractère suivant - leur nombre ou
     * leur nature (espace vs tiret, présence ou non) peut différer entre le
     * titre de série connu (MyAnimeList) et le titre réel indexé par
     * l'éditeur français sur Google Books. Un simple {@code startsWith} ne
     * suffisait pas pour deux mangas très connus, entièrement invisibles à
     * la recherche de tomes à cause de cette seule rigidité (vérifié
     * manuellement, voir historique) :
     * <ul>
     *   <li>"One Punch Man" (espace) vs "ONE-PUNCH MAN - tome 18" (tiret)</li>
     *   <li>"Haikyu!!" (aucun espace) vs "Haikyu !! - Les As du volley T10"
     *       (espace avant "!!")</li>
     * </ul>
     *
     * @return l'index dans {@code title} juste après le préfixe reconnu, ou
     * -1 si {@code title} ne commence pas par {@code seriesTitle} (aux
     * espaces/tirets près).
     */
    private static int matchSeriesPrefix(String title, String seriesTitle) {
        int i = 0;
        int j = 0;
        while (j < seriesTitle.length()) {
            while (i < title.length() && isFlexibleSeparator(title.charAt(i))) {
                i++;
            }
            while (j < seriesTitle.length() && isFlexibleSeparator(seriesTitle.charAt(j))) {
                j++;
            }
            if (j >= seriesTitle.length()) {
                break;
            }
            if (i >= title.length() || Character.toLowerCase(title.charAt(i)) != Character.toLowerCase(seriesTitle.charAt(j))) {
                return -1;
            }
            i++;
            j++;
        }
        return i;
    }

    private static boolean isFlexibleSeparator(char c) {
        return Character.isWhitespace(c) || c == '-';
    }

    // Mots caractéristiques d'un VRAI nom d'édition (voir QUICK_EDITION_KEYWORDS/
    // DEEP_EDITION_KEYWORDS) - sert à distinguer une parenthèse d'édition
    // ("Yu-Gi-Oh ! (Intégrale)") d'un alias de titre collé au nom de série
    // (voir skipLeadingAliasNotResemblingAnEdition juste en dessous).
    private static final List<String> EDITION_INDICATOR_WORDS = List.of(
            "edition", "édition", "perfect", "originale", "star", "ultimate", "deluxe", "intégrale", "integrale", "collector");

    /**
     * "City Hunter (Nicky Larson) Tome 1 . Edition de luxe" (vérifié
     * manuellement, voir historique) : certains titres font suivre le nom de
     * série d'un alias historique entre parenthèses ("Nicky Larson", nom de
     * l'adaptation française de City Hunter) AVANT le numéro de tome - sans
     * ce traitement, retirer seulement le numéro de tome au milieu du titre
     * laissait la parenthèse fermante de l'alias orpheline, mélangée au vrai
     * nom d'édition suivant ("Nicky Larson) . Edition De Luxe").
     * <p>
     * Ne s'applique QUE si le contenu entre parenthèses ne ressemble pas à
     * un nom d'édition connu - une parenthèse comme "Yu-Gi-Oh ! (Intégrale)
     * - Tome 1" doit au contraire être CONSERVÉE (dépouillée de ses
     * parenthèses par {@link #LEADING_TRAILING_SEPARATORS} plus loin), son
     * contenu étant le nom d'édition lui-même.
     *
     * @return l'index où commence le "reste" du titre à traiter par
     * {@link #extractEdition} - {@code afterSeriesPrefix} inchangé si aucun
     * alias de ce type n'est détecté.
     */
    private static int skipLeadingAliasNotResemblingAnEdition(String title, int afterSeriesPrefix) {
        int i = afterSeriesPrefix;
        while (i < title.length() && Character.isWhitespace(title.charAt(i))) {
            i++;
        }
        if (i >= title.length() || title.charAt(i) != '(') {
            return afterSeriesPrefix;
        }
        int closingParen = title.indexOf(')', i);
        if (closingParen < 0) {
            return afterSeriesPrefix;
        }
        String content = title.substring(i + 1, closingParen).toLowerCase();
        boolean looksLikeEditionName = EDITION_INDICATOR_WORDS.stream().anyMatch(content::contains);
        return looksLikeEditionName ? afterSeriesPrefix : closingParen + 1;
    }

    /** Comparaison par mot entier (?U pour reconnaître les lettres accentuées
     * comme des caractères de mot, voir DANGLING_RANGE_CONNECTOR plus haut
     * pour le même piège) - un simple contains() ferait matcher un fragment
     * générique/court à l'intérieur d'un autre mot sans rapport. */
    private static boolean matchesKnownRelatedSeries(String title, List<String> excludedTitleFragments) {
        for (String fragment : excludedTitleFragments) {
            if (Pattern.compile("(?iU)\\b" + Pattern.quote(fragment) + "\\b").matcher(title).find()) {
                return true;
            }
        }
        return false;
    }

    /**
     * Vrai si {@code volumeInfo} liste EXPLICITEMENT un ou plusieurs auteurs
     * ET qu'AUCUN ne partage de mot significatif avec {@code expectedAuthor}
     * - signal fort qu'il s'agit d'une œuvre totalement différente qui
     * partage juste le même préfixe de titre (voir javadoc de
     * {@link #extractCandidates}), plutôt qu'une autre édition/traduction de
     * la série cherchée.
     * <p>
     * Ne s'applique QUE quand les deux informations sont disponibles et
     * positives - jamais en cas d'absence (contrairement à {@code inauthor:}
     * DANS la requête, volontairement évité, voir {@link #searchOneEdition}) :
     * {@code expectedAuthor} inconnu, ou fiche Google Books sans auteur
     * listé (fréquent sur les éditions françaises, vérifié manuellement) ->
     * rien à comparer, le candidat reste éligible comme avant ce filtre.
     */
    private static boolean authorMismatch(JsonNode volumeInfo, String expectedAuthor) {
        if (expectedAuthor == null || expectedAuthor.isBlank()) {
            return false;
        }
        JsonNode authorsNode = volumeInfo.path("authors");
        if (!authorsNode.isArray() || authorsNode.isEmpty()) {
            return false;
        }
        Set<String> expectedWords = significantWords(expectedAuthor);
        if (expectedWords.isEmpty()) {
            return false;
        }
        for (JsonNode authorNode : authorsNode) {
            if (!Collections.disjoint(expectedWords, significantWords(authorNode.asText("")))) {
                return false; // au moins un nom/mot en commun avec un auteur listé -> pas un mismatch
            }
        }
        return true;
    }

    /** Mots d'au moins 3 lettres (ignore particules/initiales - "de", "van",
     * "Jr."...) - comparaison volontairement approximative, juste assez pour
     * distinguer "Naoki Urasawa" d'une œuvre sans AUCUN nom en commun, pas
     * pour valider une orthographe exacte (translittération, ordre nom/prénom
     * variable selon les fiches). */
    private static Set<String> significantWords(String name) {
        Set<String> words = new java.util.HashSet<>();
        for (String word : name.toLowerCase().split("\\s+")) {
            if (word.length() >= 3) {
                words.add(word);
            }
        }
        return words;
    }

    /** Dédoublonne par (édition, tome) - un même tome peut ressortir de plusieurs
     * requêtes/fiches (réédition, format différent, requêtes par mot-clé qui se
     * recoupent) ; on garde la première avec une jaquette plutôt que la première
     * tout court. Trié par édition puis numéro de tome pour un affichage stable. */
    private static List<VolumeCandidate> dedupeAndSort(List<VolumeCandidate> candidates) {
        Map<String, VolumeCandidate> bestByKey = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            String key = candidate.edition().toLowerCase() + "|" + candidate.volumeNumber();
            bestByKey.merge(key, candidate, (existing, replacement) -> existing.imageUrl() != null ? existing : replacement);
        }
        return bestByKey.values().stream()
                .sorted(Comparator.comparing(VolumeCandidate::edition).thenComparingInt(VolumeCandidate::volumeNumber))
                .collect(Collectors.toList());
    }

    /**
     * @param prefixEnd voir {@link #matchSeriesPrefix} - permet le repli
     *                  {@link #BARE_ZERO_PADDED_VOLUME_NUMBER} quand aucun
     *                  mot-clé n'est trouvé.
     */
    private static OptionalInt extractVolumeNumber(String title, int prefixEnd) {
        var matcher = VOLUME_NUMBER.matcher(title);
        if (matcher.find()) {
            try {
                return OptionalInt.of(Integer.parseInt(matcher.group(1)));
            } catch (NumberFormatException e) {
                return OptionalInt.empty();
            }
        }
        return extractBareZeroPaddedVolumeNumber(title, prefixEnd);
    }

    /**
     * "Sword Art Online 001 Aincrad" (vérifié manuellement, édition
     * française réelle chez Ofelbe, voir historique) : convention de
     * numérotation SANS mot-clé "Tome"/"T." ni "Vol." - juste un numéro à
     * zéro(s) de tête collé au titre de série, avant le nom de l'arc/tome.
     * Sans ce repli, {@link #VOLUME_NUMBER} ne trouvant aucun mot-clé, cette
     * édition entière (pourtant bien réelle) était invisible, rejetée comme
     * un coffret/artbook sans numéro exploitable.
     * <p>
     * Volontairement scopé au texte JUSTE APRÈS le préfixe de série
     * ({@code prefixEnd}, voir {@link #matchSeriesPrefix}), jamais cherché
     * n'importe où dans le titre comme {@link #VOLUME_NUMBER} : un nombre
     * isolé ailleurs (année, prix...) serait trop risqué à interpréter comme
     * un numéro de tome sans mot-clé pour le confirmer - le zéro de tête
     * (jamais présent dans une année à 4 chiffres usuelle) est le seul
     * signal qui rend ce repli raisonnablement sûr.
     */
    private static final Pattern BARE_ZERO_PADDED_VOLUME_NUMBER = Pattern.compile("^[\\s\\-–:,.()]*0(\\d{1,3})\\b");

    private static OptionalInt extractBareZeroPaddedVolumeNumber(String trimmedTitle, int prefixEnd) {
        if (prefixEnd < 0 || prefixEnd >= trimmedTitle.length()) {
            return OptionalInt.empty();
        }
        var matcher = BARE_ZERO_PADDED_VOLUME_NUMBER.matcher(trimmedTitle.substring(prefixEnd));
        if (!matcher.find()) {
            return OptionalInt.empty();
        }
        try {
            return OptionalInt.of(Integer.parseInt(matcher.group(1)));
        } catch (NumberFormatException e) {
            return OptionalInt.empty();
        }
    }

    // "Panini" et "Panini Manga" désignent le même éditeur réel côté Google
    // Books (vérifié manuellement sur "Demon Slayer", voir historique) -
    // certaines fiches indexent le nom complet de l'imprint manga, d'autres
    // juste la maison mère, pour le MÊME éditeur. Sans normalisation, ça
    // formait deux onglets d'édition pour un seul éditeur réel.
    private static final Pattern TRAILING_MANGA_SUFFIX = Pattern.compile("(?i)\\s+manga$");

    /** "One Piece - Édition originale - Tome 60" + série "One Piece" -> "Édition Originale".
     * "Death Note - Tome 10" + série "Death Note" -> "" -> repli sur l'éditeur ("Kana").
     * {@code seriesPrefixEnd} (voir {@link #matchSeriesPrefix}) - déjà calculé
     * par l'appelant, jamais re-dérivé ici par regex : le préfixe réel peut
     * différer légèrement de {@code seriesTitle} en espaces/tirets (ex:
     * "ONE-PUNCH MAN" pour la série "One Punch Man"). */
    private static String extractEdition(String fullTitle, int seriesPrefixEnd, String seriesTitle, String publisher) {
        String remainder = fullTitle.substring(Math.min(seriesPrefixEnd, fullTitle.length()));
        remainder = VOLUME_NUMBER.matcher(remainder).replaceAll("");
        // Numéro à zéro(s) de tête sans mot-clé (voir
        // extractBareZeroPaddedVolumeNumber) - ex: "Sword Art Online 001
        // Aincrad" -> ne garder que "Aincrad", pas "001 Aincrad".
        remainder = BARE_ZERO_PADDED_VOLUME_NUMBER.matcher(remainder).replaceFirst("");
        remainder = DANGLING_RANGE_CONNECTOR.matcher(remainder).replaceAll("");
        remainder = LEADING_TRAILING_SEPARATORS.matcher(remainder).replaceAll("").trim();
        // "Team-up Mission" / "Team-Up Mission" / "Team Up Mission" (les trois
        // formes existent réellement selon la fiche Google Books, vérifié
        // manuellement sur "My Hero Academia") doivent former UNE seule
        // édition, pas trois onglets quasi identiques - le tiret interne est
        // traité comme un simple espace avant capitalisation ; seuls les
        // tirets de bord (déjà retirés ci-dessus) servaient de séparateur
        // avec le reste du titre.
        remainder = remainder.replace('-', ' ').replaceAll("\\s+", " ").trim();
        // "Kingdom - Tome 70 - Kingdom" (vérifié manuellement, voir historique) :
        // le titre de la série se répète après le numéro de tome sur certaines
        // fiches Google Books - une fois le préfixe et le numéro retirés, il
        // ne reste QUE ce doublon, qui ressemblerait sinon à un vrai nom de
        // collection appelé "Kingdom" (identique à la série elle-même, donc
        // sans aucune valeur informative). Traité comme si rien ne restait.
        if (remainder.equalsIgnoreCase(seriesTitle.trim())) {
            remainder = "";
        }
        if (!remainder.isBlank()) {
            return capitalizeWords(remainder);
        }
        return normalizePublisherFallback(publisher);
    }

    /** Un éditeur réel contient toujours au moins une lettre - filet de
     * sécurité contre une incohérence de données constatée manuellement côté
     * Google Books (voir historique) : le endpoint de RECHERCHE ({@code
     * /volumes?q=...}) renvoie parfois un champ {@code publisher} corrompu
     * ("12-21", ressemblant à une plage de tomes ou un code interne mal
     * placé) pour un identifiant dont le endpoint de LECTURE ({@code
     * /volumes/{id}}) renvoie pourtant la bonne valeur ("UNIVERS POCHE") -
     * repéré sur plusieurs tomes distincts de "Vinland Saga". Impossible à
     * corriger à la source (pas de second appel par identifiant, beaucoup
     * trop coûteux pour ce best-effort) - autant retomber sur "Édition
     * inconnue" plutôt qu'afficher un nom d'édition absurde. */
    private static String normalizePublisherFallback(String publisher) {
        if (publisher == null || publisher.isBlank() || !containsLetter(publisher)) {
            return "Édition inconnue";
        }
        return TRAILING_MANGA_SUFFIX.matcher(publisher).replaceFirst("");
    }

    private static boolean containsLetter(String text) {
        return text.chars().anyMatch(Character::isLetter);
    }

    /** "perfect edition" -> "Perfect Edition" - Google Books indexe souvent le nom
     * de collection tout en minuscules dans le titre brut, contrairement au nom
     * de l'éditeur (déjà correctement casé, ex: "Glénat Manga") utilisé en repli. */
    private static String capitalizeWords(String text) {
        StringBuilder result = new StringBuilder();
        for (String word : text.split(" ")) {
            if (word.isEmpty()) {
                continue;
            }
            if (result.length() > 0) {
                result.append(' ');
            }
            result.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return result.toString();
    }
}
