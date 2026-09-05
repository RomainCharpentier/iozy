package com.iozycore.metadata.manga;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.shared.TexteRecherche;
import com.iozycore.metadata.QuotaExceededException;
import com.iozycore.metadata.SourceUnavailableException;
import com.iozycore.metadata.TtlCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Les TOMES d'un manga et leurs éditions françaises - le cœur du module
 * manga (extrait de MetadataSearchService au Lot 132).
 * <p>
 * Interroge en parallèle les {@link VolumeSearchProvider} compétents (BnF en
 * tête, Google Books, Open Library - voir leurs {@code @Order}), comble les
 * trous tome par tome, puis « finalise » la liste : éditeurs renommés
 * unifiés, « Édition inconnue » rattachée par préfixe ISBN ou élaguée,
 * orthographes uniformisées, éditions homonymes séparées par l'ISBN, doublons
 * fusionnés en gardant la jaquette. Chaque règle porte la mesure qui l'a fait
 * naître (Doubt, Boruto, One Piece, Jujutsu Kaisen... voir
 * DESIGN_MIGRATION_V1.2.md, lots 119 à 131).
 * <p>
 * volumeSearchCache/volumeSearchCacheRepository suivent la logique du cache
 * de recherche par titre, PAS celle des codes-barres : une liste vide
 * « aucune édition française » (série non reprise en France, licence
 * abandonnée...) est mise en cache comme un vrai résultat trouvé - sans ça,
 * une série sans édition française relançait les requêtes à CHAQUE
 * recherche, indéfiniment. Seul un résultat vide causé par un fournisseur
 * muet ou à quota dépassé reste exclu du cache durable (échec transitoire,
 * pas une vraie absence de résultat) - « Actualiser » reste le seul moyen de
 * revérifier une série déjà en cache, vide ou non. Et le cache durable ne se
 * périme jamais : à chaque changement de chaîne, une migration le vide (V33).
 */
@Service
public class TomeSearchService {

    private static final Logger log = LoggerFactory.getLogger(TomeSearchService.class);

    private final List<VolumeSearchProvider> volumeSearchProviders;
    private final VolumeSearchCacheRepository volumeSearchCacheRepository;

    // Cache mémoire "chaud" (évite un aller-retour base pour des recherches
    // rapprochées dans la même fenêtre) - le stockage durable, lui, est
    // volumeSearchCacheRepository (survit aux redémarrages, voir plus bas).
    private final TtlCache<String, List<VolumeCandidate>> volumeSearchCache = new TtlCache<>(Duration.ofHours(24), 300);
    /** Les résultats obtenus pendant qu'un fournisseur se taisait - voir searchVolumes. */
    private final TtlCache<String, List<VolumeCandidate>> volumeSearchPartialCache = new TtlCache<>(Duration.ofHours(1), 300);

    public TomeSearchService(List<VolumeSearchProvider> volumeSearchProviders,
                             VolumeSearchCacheRepository volumeSearchCacheRepository) {
        this.volumeSearchProviders = volumeSearchProviders;
        this.volumeSearchCacheRepository = volumeSearchCacheRepository;
    }

    /** La cle de comparaison des titres - accents et ponctuation plies, comme la recherche locale (voir TexteRecherche). */
    private static String normalize(String value) {
        return TexteRecherche.normaliser(value);
    }

    /**
     * Recherche best-effort des tomes réels (avec jaquette) des éditions
     * françaises d'une série (voir GoogleBooksVolumeSearchProvider, 8
     * requêtes en parallèle par appel - coûteux) - déclenchée après
     * sélection d'une suggestion, pour proposer une sélection visuelle des
     * tomes possédés plutôt qu'une saisie manuelle du numéro de tome.
     * {@code volumes} vide si le type n'est pas couvert ou si rien n'a été
     * trouvé (l'appelant garde alors le parcours de saisie manuelle) -
     * {@code quotaExceeded} (voir VolumeSearchResult) distingue ce cas d'un
     * quota externe dépassé, pour que le client puisse le signaler plutôt
     * que de laisser croire à tort "aucune édition trouvée".
     */
    public VolumeSearchResult searchVolumes(EntityType entityType, String seriesTitle, String author) {
        return searchVolumes(entityType, seriesTitle, author, false, List.of());
    }

    /**
     * @param forceRefresh ignore le cache mémoire ET le stockage durable,
     *                      relance systématiquement les requêtes Google
     *                      Books et écrase le résultat stocké - c'est le
     *                      point d'entrée du bouton "Actualiser" côté
     *                      client. Sans lui, un résultat une fois stocké
     *                      n'est plus jamais rappelé automatiquement : les
     *                      éditions/tomes d'une série changent rarement, pas
     *                      la peine de re-payer des appels externes à chaque
     *                      sélection du même candidat.
     */
    public VolumeSearchResult searchVolumes(EntityType entityType, String seriesTitle, String author, boolean forceRefresh) {
        return searchVolumes(entityType, seriesTitle, author, forceRefresh, List.of());
    }

    /**
     * @param excludedTitleFragments fragments de titre (voir RelatedSeriesService)
     *                               identifiant un spin-off/side-story connu de
     *                               la série cherchée - jamais pris en compte
     *                               pour la clé de cache (dépend seulement du
     *                               titre/auteur cherchés, comme le reste de ce
     *                               cache) : un résultat déjà en cache SANS ce
     *                               filtre n'est pas nettoyé rétroactivement,
     *                               "Actualiser"/une recherche approfondie
     *                               restent les seuls moyens de le relancer.
     */
    public VolumeSearchResult searchVolumes(EntityType entityType, String seriesTitle, String author, boolean forceRefresh, List<String> excludedTitleFragments) {
        return searchVolumes(entityType, seriesTitle, author, forceRefresh, excludedTitleFragments, null);
    }

    /** Au plus autant de sondes par recherche : la sonde coute une requete Google Books par tome manquant. */
    static final int SONDES_MAX = 12;

    /** Trois numeros de suite sans reponse : le total connu est probablement faux (ou l'edition francaise s'arrete la). */
    static final int ECHECS_CONSECUTIFS_MAX = 3;

    /**
     * @param totalVolumes le nombre de tomes de la serie d'apres le catalogue
     *                     (AniList/MyAnimeList), ou null - c'est jusqu'a lui
     *                     que les trous sont sondes (voir comblerLesTrous)
     */
    public VolumeSearchResult searchVolumes(EntityType entityType, String seriesTitle, String author, boolean forceRefresh,
                                            List<String> excludedTitleFragments, Integer totalVolumes) {
        String normalizedTitle = normalize(seriesTitle);
        String normalizedAuthor = normalize(author == null ? "" : author);
        String cacheKey = entityType.id() + "|" + normalizedTitle + "|" + normalizedAuthor;

        if (!forceRefresh) {
            // Ce qui sort d'un cache repasse par les regles de nommage (voir
            // finaliser) : elles evoluent (Lots 123-125), et une ligne ecrite
            // avant elles ressortait sinon telle quelle - « Ki-oon » et
            // « Ki-Oon » en deux editions sur une ligne de 15 h, alors que le
            // meme titre rafraichi a 16 h n'en montrait qu'une. C'est ce
            // va-et-vient que l'utilisateur a vu sur « Doubt » (Lot 126).
            Optional<List<VolumeCandidate>> inMemory = volumeSearchCache.get(cacheKey);
            if (inMemory.isPresent()) {
                return VolumeSearchResult.of(finaliser(inMemory.get()));
            }

            Optional<List<VolumeCandidate>> stored = volumeSearchCacheRepository.find(entityType.id(), normalizedTitle, normalizedAuthor);
            if (stored.isPresent()) {
                volumeSearchCache.put(cacheKey, stored.get()); // réchauffe le cache mémoire pour les appels suivants
                return VolumeSearchResult.of(finaliser(stored.get()));
            }

            // Un résultat PARTIEL (un fournisseur muet) n'est jamais persisté,
            // mais il est gardé une heure en mémoire : sans ça, chaque
            // ouverture de l'aperçu pendant une panne de Google Books
            // relançait la BnF et ses vérifications de jaquettes, jusqu'à ce
            // qu'elle limite le débit à son tour (429 constaté le 2026-09-04).
            Optional<List<VolumeCandidate>> partiel = volumeSearchPartialCache.get(cacheKey);
            if (partiel.isPresent()) {
                return new VolumeSearchResult(partiel.get(), true);
            }
        }

        // Boucle explicite (plutôt qu'un stream) : un fournisseur en échec ne
        // doit pas faire perdre les résultats déjà obtenus des AUTRES
        // fournisseurs compétents pour ce type (contrairement à un
        // flatMap+collect, qui abandonnerait tout dès la première exception).
        List<VolumeCandidate> result = new ArrayList<>();
        boolean providerUnavailable = false;
        for (VolumeSearchProvider provider : volumeSearchProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            try {
                result.addAll(provider.searchVolumes(seriesTitle, author, excludedTitleFragments));
            } catch (QuotaExceededException | SourceUnavailableException e) {
                // Quota dépassé OU source muette : dans les deux cas le
                // fournisseur n'a rien DIT, ce n'est pas une absence de tomes.
                providerUnavailable = true;
            }
        }
        // Deux fournisseurs (BnF puis Google Books, voir leurs @Order)
        // peuvent retrouver le même tome : la notice du PREMIER fait foi
        // (Lot 119 - la BnF a des champs structurés, Google Books devine
        // l'édition dans un titre libre), et la jaquette vient de celui qui
        // en a une.
        if (totalVolumes != null && totalVolumes > 0) {
            try {
                result.addAll(comblerLesTrous(entityType, seriesTitle, author, excludedTitleFragments, result, totalVolumes));
            } catch (QuotaExceededException | SourceUnavailableException e) {
                // Une sonde qui echoue ne perd rien de ce qui est deja la ;
                // elle interdit seulement de figer ce resultat comme complet.
                providerUnavailable = true;
            }
        }
        result = finaliser(result);
        // Une liste vide EST mise en cache (contrairement à barcodeCache/
        // frenchTitleCache, voir le commentaire sur volumeSearchCache
        // ci-dessus) - seul un résultat vide causé par un échec transitoire du
        // fournisseur ne l'est jamais, pour ne pas condamner une recherche
        // pendant des jours à cause d'une panne de quelques minutes.
        //
        // Sans auteur, jamais de cache durable (Lot 126) : « Doubt » seul
        // designe aussi un homonyme chez un autre editeur, et une ligne
        // ecrite sur ce titre nu resservait l'homonyme a chaque ouverture
        // dont la recherche de metadonnees avait echoue. En memoire, une
        // journee au plus.
        boolean cacheDurable = !normalizedAuthor.isBlank();
        if (!providerUnavailable) {
            volumeSearchCache.put(cacheKey, result);
            if (cacheDurable) {
                volumeSearchCacheRepository.save(entityType.id(), normalizedTitle, normalizedAuthor, result);
            }
        } else if (!result.isEmpty()) {
            volumeSearchPartialCache.put(cacheKey, result);
            if (forceRefresh) {
                // « Actualiser » a parle : une ligne plus ancienne ne doit pas
                // lui survivre. Pendant une panne, le resultat partiel ne
                // peut pas etre fige comme complet, mais l'ancien ne peut
                // pas non plus etre resservi a la prochaine ouverture - c'est
                // exactement ce qui faisait revenir « 3 et 1 » apres « 4 et 2 »
                // a chaque redemarrage (Lot 126).
                volumeSearchCache.invalidate(cacheKey);
                if (cacheDurable) {
                    volumeSearchCacheRepository.delete(entityType.id(), normalizedTitle, normalizedAuthor);
                }
            }
        }
        return new VolumeSearchResult(result, providerUnavailable);
    }

    /**
     * Recherche approfondie optionnelle (voir GoogleBooksVolumeSearchProvider.
     * DEEP_EDITION_KEYWORDS) - déclenchée uniquement par une action explicite
     * de l'utilisateur ("Chercher plus d'éditions" côté client), jamais
     * automatiquement : {@link #searchVolumes} ne couvre par défaut que les
     * mots-clés les plus courants pour limiter le coût, la majorité des
     * mangas n'ayant aucune édition spéciale. FUSIONNE avec le résultat déjà
     * connu (mémoire ou stockage durable) plutôt que de le remplacer - une
     * recherche approfondie une fois faite reste acquise dans le cache,
     * comme le reste de {@link #searchVolumes} (jamais rappelée
     * automatiquement, "Actualiser" ou un nouvel appel à cette méthode sont
     * les seuls moyens de la relancer).
     */
    public VolumeSearchResult searchAdditionalEditions(EntityType entityType, String seriesTitle, String author) {
        return searchAdditionalEditions(entityType, seriesTitle, author, List.of());
    }

    /** Variante avec exclusion de spin-offs connus (voir
     * {@link #searchVolumes(EntityType, String, String, boolean, List)}). */
    public VolumeSearchResult searchAdditionalEditions(EntityType entityType, String seriesTitle, String author, List<String> excludedTitleFragments) {
        String normalizedTitle = normalize(seriesTitle);
        String normalizedAuthor = normalize(author == null ? "" : author);
        String cacheKey = entityType.id() + "|" + normalizedTitle + "|" + normalizedAuthor;

        List<VolumeCandidate> existing = volumeSearchCache.get(cacheKey)
                .or(() -> volumeSearchCacheRepository.find(entityType.id(), normalizedTitle, normalizedAuthor))
                .orElseGet(List::of);

        List<VolumeCandidate> additional = new ArrayList<>();
        boolean providerUnavailable = false;
        for (VolumeSearchProvider provider : volumeSearchProviders) {
            if (!provider.supports(entityType)) {
                continue;
            }
            try {
                additional.addAll(provider.searchAdditionalEditions(seriesTitle, author, excludedTitleFragments));
            } catch (QuotaExceededException | SourceUnavailableException e) {
                providerUnavailable = true;
            }
        }
        additional = dedupeVolumesPreferringImage(additional);

        List<VolumeCandidate> merged = mergeVolumes(existing, additional);
        if (!providerUnavailable) {
            volumeSearchCache.put(cacheKey, merged);
            volumeSearchCacheRepository.save(entityType.id(), normalizedTitle, normalizedAuthor, merged);
        }
        return new VolumeSearchResult(merged, providerUnavailable);
    }

    /** Fusionne sans dupliquer par (édition, tome) - garde la version déjà
     * connue en cas de collision, SAUF si elle n'a pas de jaquette et que la
     * nouvelle en a une (voir {@link #dedupeVolumesPreferringImage}) : rien
     * n'empêche une recherche approfondie de retrouver via un autre
     * fournisseur/mot-clé un tome déjà connu sans jaquette (ex: BnF lors de
     * {@link #searchVolumes}, Google Books lors de cette recherche
     * approfondie). */
    private static List<VolumeCandidate> mergeVolumes(List<VolumeCandidate> existing, List<VolumeCandidate> additional) {
        Map<String, VolumeCandidate> byKey = new LinkedHashMap<>();
        for (VolumeCandidate candidate : existing) {
            byKey.put(volumeKey(candidate), candidate);
        }
        for (VolumeCandidate candidate : additional) {
            byKey.merge(volumeKey(candidate), candidate, TomeSearchService::fusionnerTome);
        }
        return new ArrayList<>(byKey.values());
    }

    /** Dédoublonne par (édition, tome) au sein d'une même liste (voir
     * {@link #mergeVolumes}) - utile quand PLUSIEURS fournisseurs
     * compétents pour le même EntityType (Google Books et BnF, voir
     * BnfVolumeSearchProvider) retrouvent indépendamment le même tome :
     * la BnF ne fournissant jamais de jaquette, la version Google Books
     * (avec jaquette) est préférée en cas de collision. */
    private static List<VolumeCandidate> dedupeVolumesPreferringImage(List<VolumeCandidate> candidates) {
        Map<String, VolumeCandidate> byKey = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            byKey.merge(volumeKey(candidate), candidate, TomeSearchService::fusionnerTome);
        }
        return new ArrayList<>(byKey.values());
    }

    /** Le premier rencontré garde ses champs ; seule une jaquette manquante est prise chez le second. */
    private static VolumeCandidate fusionnerTome(VolumeCandidate existing, VolumeCandidate replacement) {
        if (existing.imageUrl() != null || replacement.imageUrl() == null) {
            return existing;
        }
        return new VolumeCandidate(existing.edition(), existing.volumeNumber(), replacement.imageUrl(), existing.title());
    }

    /**
     * « Sait-on DÉJÀ qu'aucun tome n'existe pour cette série ? », sans jamais
     * interroger un fournisseur.
     * <p>
     * Consulte uniquement le stockage durable ({@link VolumeSearchCacheRepository},
     * voir V3__volume_search_cache.sql), où une liste vide EST mémorisée -
     * c'est ce qui rend la question gratuite. Une série jamais recherchée
     * renvoie donc {@code false} : « on ne sait pas » et « on sait qu'il n'y
     * en a pas » ne se confondent pas, sous peine de signaler à tort toute
     * œuvre encore inconnue.
     * <p>
     * Ne réchauffe volontairement PAS le cache mémoire : cette lecture sert un
     * affichage secondaire (une mention dans une liste de résultats), elle ne
     * doit pas influencer ce que le prochain vrai appel trouvera.
     */
    public boolean isVolumeSearchKnownEmpty(EntityType entityType, String seriesTitle, String author) {
        return volumeSearchCacheRepository
                .find(entityType.id(), normalize(seriesTitle), normalize(author == null ? "" : author))
                .map(List::isEmpty)
                .orElse(false);
    }

    private static String volumeKey(VolumeCandidate candidate) {
        return candidate.key();
    }

    /**
     * Une seule orthographe par edition (Lot 123).
     *
     * <p>Le nom de l'edition est la CLE DE REGROUPEMENT a l'ecran : deux
     * orthographes font deux editions. Or les sources ne sont pas
     * constantes - la BnF catalogue « Doubt » T1 a T3 chez « Ki-oon » et le
     * T4 chez « Ki-Oon » (releve le 2026-09-04), et l'apercu affichait donc
     * une edition de trois tomes et une autre d'un seul. Le
     * dedoublonnage, lui, ne voyait rien : sa cle est deja insensible a la
     * casse (voir {@link VolumeCandidate#key()}), mais elle ne corrige pas
     * le libelle affiche.
     *
     * <p>L'orthographe retenue est la PLUS FREQUENTE - celle du plus grand
     * nombre de tomes -, et le premier arrive departage. Rien n'est
     * fusionne ni supprime ici : seuls des libelles sont reecrits.
     */
    static List<VolumeCandidate> uniformiserLesEditions(List<VolumeCandidate> candidates) {
        Map<String, Map<String, Integer>> orthographesParEdition = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            orthographesParEdition
                    .computeIfAbsent(cleEdition(candidate.edition()), cle -> new LinkedHashMap<>())
                    .merge(candidate.edition(), 1, Integer::sum);
        }
        Map<String, String> retenue = new LinkedHashMap<>();
        orthographesParEdition.forEach((cle, orthographes) -> retenue.put(cle, orthographes.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(cle)));

        List<VolumeCandidate> uniformises = new ArrayList<>(candidates.size());
        for (VolumeCandidate candidate : candidates) {
            String edition = retenue.get(cleEdition(candidate.edition()));
            uniformises.add(edition.equals(candidate.edition()) ? candidate
                    : new VolumeCandidate(edition, candidate.volumeNumber(), candidate.imageUrl(), candidate.title()));
        }
        return uniformises;
    }

    /**
     * Combler les trous (Lot 125) : les numeros absents entre 1 et le total
     * connu, sondes un par un chez le fournisseur qui sait le faire.
     *
     * <p>Pourquoi apres les recherches et non a leur place : une sonde coute
     * une requete PAR tome. Sur une serie que la BnF connait entierement
     * (Boruto, 20/20), elle ne coute rien ; sur une serie qu'elle ne connait
     * qu'a moitie, elle coute la moitie. Plafond a {@link #SONDES_MAX} par
     * recherche, et arret apres {@link #ECHECS_CONSECUTIFS_MAX} numeros de
     * suite sans reponse - un total catalogue peut etre faux, ou l'edition
     * francaise s'arreter avant le Japon.
     *
     * <p>Le tome sonde est rattache a une edition deja la par son
     * <b>prefixe ISBN</b> quand Google Books ne donne pas d'editeur (frequent
     * sur ses fiches francaises) : le tome 3 de Doubt, ISBN 978-2-35592…,
     * rejoint l'edition dont les tomes 1 et 2 portent ce meme bloc. Sans
     * ISBN ni editeur, il n'est pas retenu : une « Edition inconnue » de plus
     * n'aiderait personne.
     */
    private List<VolumeCandidate> comblerLesTrous(EntityType entityType, String seriesTitle, String author,
                                                  List<String> excludedTitleFragments,
                                                  List<VolumeCandidate> dejaTrouves, int totalVolumes) {
        Set<Integer> presents = dejaTrouves.stream().map(VolumeCandidate::volumeNumber).collect(Collectors.toSet());
        Map<String, String> editionParPrefixe = editionsNommeesParPrefixe(dejaTrouves);

        List<VolumeCandidate> combles = new ArrayList<>();
        int sondes = 0;
        int echecsConsecutifs = 0;
        for (int numero = 1; numero <= totalVolumes && sondes < SONDES_MAX && echecsConsecutifs < ECHECS_CONSECUTIFS_MAX; numero++) {
            if (presents.contains(numero)) {
                continue;
            }
            List<VolumeCandidate> trouves = new ArrayList<>();
            for (VolumeSearchProvider provider : volumeSearchProviders) {
                if (provider.supports(entityType)) {
                    trouves.addAll(provider.probeVolume(seriesTitle, author, numero, excludedTitleFragments));
                }
            }
            sondes++;
            boolean retenu = false;
            for (VolumeCandidate candidate : trouves) {
                String prefixe = prefixeIsbn(candidate);
                String edition = prefixe != null ? editionParPrefixe.get(prefixe) : null;
                if (edition == null && (candidate.edition() == null || candidate.edition().isBlank()
                        || candidate.edition().equalsIgnoreCase("Édition inconnue"))) {
                    continue;
                }
                combles.add(edition == null ? candidate : renommer(candidate, edition));
                retenu = true;
            }
            echecsConsecutifs = retenu ? 0 : echecsConsecutifs + 1;
        }
        if (!combles.isEmpty()) {
            log.info("Trous combles pour '{}' : {} tome(s) retrouve(s) par sonde ({} sonde(s))", seriesTitle, combles.size(), sondes);
        }
        return combles;
    }

    static final String EDITION_INCONNUE = "Édition inconnue";

    /**
     * Un editeur qui a change de nom reste le meme editeur (Lot 127). Kazé
     * est devenu Crunchyroll en 2022 : la BnF dit « Kazé » sur les tomes 1 a
     * 11 de « Chainsaw Man » et Google Books « Crunchyroll » sur les
     * suivants, et l'ecran en faisait deux editions. Mangacollec - la
     * reference de l'utilisateur - les ecrit « Kazé / Crunchyroll », en une
     * seule ; on adopte son libelle. Cle normalisee (voir TexteRecherche)
     * vers libelle affiche.
     */
    private static final Map<String, String> EDITEURS_RENOMMES = Map.of(
            "kaze", "Kazé / Crunchyroll",
            "kaze manga", "Kazé / Crunchyroll",
            "crunchyroll", "Kazé / Crunchyroll",
            // Les premiers Naruto (1999-2004) sont deposes au nom de la maison
            // mere de l'epoque ; mangacollec ne connait que Kana (mesure du
            // 2026-09-05 : dix tomes a part, 11 a 22).
            "dargaud benelux kana", "Kana",
            // Une coquille du catalogue, sur un tome de One Piece.
            "edition orinale", "Édition Originale");

    static List<VolumeCandidate> unifierLesEditeursRenommes(List<VolumeCandidate> candidates) {
        List<VolumeCandidate> unifies = new ArrayList<>(candidates.size());
        for (VolumeCandidate candidate : candidates) {
            String libelle = EDITEURS_RENOMMES.get(cleEdition(candidate.edition()));
            unifies.add(libelle == null || libelle.equals(candidate.edition()) ? candidate : renommer(candidate, libelle));
        }
        return unifies;
    }

    /**
     * Les regles de nommage et de regroupement, dans l'ordre ou elles se
     * completent - appliquees a tout ce qui sort, frais ou cache :
     * rattacher les « Édition inconnue » a leur bloc ISBN, unifier les
     * orthographes, separer les editions homonymes (AVANT le dedoublonnage,
     * qui fusionnerait leurs deux tomes 1), dedoublonner.
     */
    static List<VolumeCandidate> finaliser(List<VolumeCandidate> candidates) {
        List<VolumeCandidate> result = unifierLesEditeursRenommes(candidates);
        result = rattacherLesEditionsInconnues(result);
        result = elaguerLesInconnues(result);
        result = uniformiserLesEditions(result);
        result = separerLesEditionsHomonymes(result);
        return dedupeVolumesPreferringImage(result);
    }

    /** Les blocs ISBN dont on connait l'edition : prefixe -> nom, sans jamais retenir « Édition inconnue ». */
    private static Map<String, String> editionsNommeesParPrefixe(List<VolumeCandidate> candidates) {
        Map<String, String> parPrefixe = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            String prefixe = prefixeIsbn(candidate);
            if (prefixe != null && estNommee(candidate.edition())) {
                parPrefixe.putIfAbsent(prefixe, candidate.edition());
            }
        }
        return parPrefixe;
    }

    private static boolean estNommee(String edition) {
        return edition != null && !edition.isBlank() && !edition.equalsIgnoreCase(EDITION_INCONNUE);
    }

    /**
     * « Édition inconnue » n'est pas une edition : c'est un tome dont la
     * source n'a pas dit l'editeur (Lot 125). Google Books le fait souvent
     * sur ses fiches francaises - « Spy x Family » y sortait avec une
     * « Édition inconnue » de sept tomes A COTE de Kurokawa, les memes
     * livres. Quand un tel tome porte un ISBN du meme bloc qu'une edition
     * nommee, il la rejoint ; sinon il garde son etiquette, faute de mieux.
     */
    /**
     * Un tome « Édition inconnue » dont le NUMERO existe deja dans une
     * edition nommee n'apporte rien : c'est le meme tome, vu par une source
     * qui ne connaissait pas son editeur (Google Books sans champ publisher),
     * et que le rattachement par ISBN n'a pas su placer. Mesure du
     * 2026-09-05 : One-Punch Man, Kurokawa 34/34 exacts - et seize
     * « inconnus » de 2 a 23 a cote, la ou mangacollec n'a qu'une edition.
     * Ne reste inconnu que ce qu'aucune edition nommee ne couvre.
     */
    static List<VolumeCandidate> elaguerLesInconnues(List<VolumeCandidate> candidates) {
        Set<Integer> couverts = new HashSet<>();
        for (VolumeCandidate candidate : candidates) {
            if (aUneEditionNommee(candidate.edition())) {
                couverts.add(candidate.volumeNumber());
            }
        }
        List<VolumeCandidate> result = new ArrayList<>(candidates.size());
        for (VolumeCandidate candidate : candidates) {
            if (!aUneEditionNommee(candidate.edition()) && couverts.contains(candidate.volumeNumber())) {
                continue;
            }
            result.add(candidate);
        }
        return result;
    }

    private static boolean aUneEditionNommee(String edition) {
        return edition != null && !edition.isBlank() && !edition.equalsIgnoreCase(EDITION_INCONNUE);
    }

    static List<VolumeCandidate> rattacherLesEditionsInconnues(List<VolumeCandidate> candidates) {
        Map<String, String> parPrefixe = editionsNommeesParPrefixe(candidates);
        if (parPrefixe.isEmpty()) {
            return candidates;
        }
        List<VolumeCandidate> rattaches = new ArrayList<>(candidates.size());
        for (VolumeCandidate candidate : candidates) {
            String edition = estNommee(candidate.edition()) ? null : parPrefixe.get(prefixeIsbn(candidate));
            rattaches.add(edition == null ? candidate : renommer(candidate, edition));
        }
        return rattaches;
    }

    /** Meme regle que la cle de dedoublonnage d'un tome : casse et espaces de bord ignores. */
    private static String cleEdition(String edition) {
        return edition == null ? "" : TexteRecherche.normaliser(edition);
    }

    /** Les huit premiers chiffres d'un ISBN-13 : préfixe de langue + bloc de l'éditeur, ce qui change d'une édition à l'autre. */
    private static final int LONGUEUR_PREFIXE_ISBN = 8;

    /**
     * Un même éditeur, deux éditions : les séparer (Lot 124).
     *
     * <p>Le nom de l'éditeur ne suffit pas à nommer une édition. « Doubt »
     * (Yoshiki Tonogai) existe chez Ki-oon en 4 tomes (2009-2010) ET en
     * 2 tomes doubles (2022) - même éditeur, mêmes numéros 1 et 2. Le
     * dédoublonnage par (édition, numéro) les fusionnait donc en silence,
     * et l'écran n'en montrait qu'une.
     *
     * <p>Ce qui les distingue objectivement, c'est l'<b>ISBN</b> : chaque
     * édition a le sien, et les huit premiers chiffres (préfixe de langue
     * + bloc de l'éditeur) diffèrent d'une édition à l'autre -
     * 978-2-35592… contre 979-10-327… dans ce cas. Choix de l'utilisateur
     * le 2026-09-04, préféré à l'année, plus lisible mais moins sûre.
     *
     * <p><b>La séparation n'a lieu qu'en cas de preuve</b> : il faut qu'un
     * même numéro de tome arrive avec deux préfixes différents. Une édition
     * dont les tomes s'étalent sur deux blocs ISBN sans jamais se
     * chevaucher reste une seule édition - c'est ce garde-fou qui évite de
     * scinder à tort les séries longues. Le nom retenu ajoute l'année du
     * plus ancien tome du bloc, seule mention lisible dont on dispose ;
     * à défaut, les quatre chiffres du bloc éditeur.
     *
     * <p>Les tomes sans ISBN ne peuvent être attribués à aucun bloc : ils
     * restent dans le plus fourni, celui qui garde le nom d'origine.
     */
    static List<VolumeCandidate> separerLesEditionsHomonymes(List<VolumeCandidate> candidates) {
        Map<String, List<VolumeCandidate>> parEdition = new LinkedHashMap<>();
        for (VolumeCandidate candidate : candidates) {
            parEdition.computeIfAbsent(cleEdition(candidate.edition()), cle -> new ArrayList<>()).add(candidate);
        }

        List<VolumeCandidate> resultat = new ArrayList<>(candidates.size());
        for (List<VolumeCandidate> groupe : parEdition.values()) {
            resultat.addAll(separerUnGroupe(groupe));
        }
        return resultat;
    }

    private static List<VolumeCandidate> separerUnGroupe(List<VolumeCandidate> groupe) {
        Map<String, List<VolumeCandidate>> parPrefixe = new LinkedHashMap<>();
        List<VolumeCandidate> sansIsbn = new ArrayList<>();
        for (VolumeCandidate candidate : groupe) {
            String prefixe = prefixeIsbn(candidate);
            if (prefixe == null) {
                sansIsbn.add(candidate);
            } else {
                parPrefixe.computeIfAbsent(prefixe, p -> new ArrayList<>()).add(candidate);
            }
        }
        if (parPrefixe.size() < 2) {
            return groupe;
        }

        // Le bloc le plus fourni est l'edition principale : elle garde son nom.
        String prefixePrincipal = parPrefixe.entrySet().stream()
                .max(Comparator.comparingInt(entree -> entree.getValue().size()))
                .map(Map.Entry::getKey)
                .orElseThrow();
        Set<Integer> numerosPrincipaux = parPrefixe.get(prefixePrincipal).stream()
                .map(VolumeCandidate::volumeNumber)
                .collect(Collectors.toSet());

        List<VolumeCandidate> separes = new ArrayList<>(groupe.size());
        for (Map.Entry<String, List<VolumeCandidate>> bloc : parPrefixe.entrySet()) {
            List<VolumeCandidate> tomes = bloc.getValue();
            boolean aPart = !bloc.getKey().equals(prefixePrincipal)
                    && estUneAutreEdition(tomes, numerosPrincipaux);
            String nom = aPart ? nommerBloc(tomes.get(0).edition(), tomes, bloc.getKey()) : null;
            for (VolumeCandidate candidate : tomes) {
                separes.add(aPart ? renommer(candidate, nom) : candidate);
            }
        }
        separes.addAll(sansIsbn);
        return separes;
    }

    /**
     * Un bloc ISBN est-il une AUTRE edition, ou la suite de la meme ?
     *
     * <p>Un editeur change de bloc ISBN au fil des annees : les tomes 1 a 12
     * de « Vinland Saga » chez Kurokawa n'ont pas le meme prefixe que les
     * tomes 13 a 24, et ce sont pourtant les memes livres, la meme edition.
     * Un premier essai qui separait des que deux blocs coexistaient a donc
     * eclate cette serie en quatre (constate le 2026-09-04) - il ne faut
     * separer que sur une preuve bien plus etroite :
     *
     * <ul>
     *   <li><b>tous</b> les numeros du bloc existent deja dans l'edition
     *       principale - un bloc qui apporte des tomes inedits en est la
     *       suite, pas un doublon ;</li>
     *   <li>et ces numeros forment une serie <b>continue depuis 1</b> -
     *       c'est la forme d'une reedition (double, integrale, perfect),
     *       qui recommence toujours au tome 1.</li>
     * </ul>
     *
     * <p>« Doubt » : le bloc de 2022 porte {1, 2}, tous deux presents dans
     * l'edition de 2009 (1 a 4), et continus depuis 1 - c'est bien
     * l'edition double. Le bloc Kurokawa de 2024 porte {1, 28, 29} : 28 et
     * 29 sont inedits, donc ce n'est pas une autre edition.
     */
    private static boolean estUneAutreEdition(List<VolumeCandidate> tomes, Set<Integer> numerosPrincipaux) {
        Set<Integer> numeros = tomes.stream().map(VolumeCandidate::volumeNumber).collect(Collectors.toSet());
        // Un seul tome n'est pas une edition : c'est un retirage du tome 1
        // sous un autre prefixe ISBN (mesure du 2026-09-05 : One Piece
        // rendait « Glenat (2000) » et « Glenat (2006) », un tome chacun).
        // Une reedition en compte au moins deux - l'edition double de Doubt.
        if (numeros.size() < 2 || !numerosPrincipaux.containsAll(numeros)) {
            return false;
        }
        for (int n = 1; n <= numeros.size(); n++) {
            if (!numeros.contains(n)) {
                return false;
            }
        }
        return true;
    }

    private static String nommerBloc(String edition, List<VolumeCandidate> tomes, String prefixe) {
        Integer annee = tomes.stream()
                .map(VolumeCandidate::annee)
                .filter(java.util.Objects::nonNull)
                .min(Integer::compareTo)
                .orElse(null);
        return edition + " (" + (annee != null ? annee : prefixe.substring(prefixe.length() - 4)) + ")";
    }

    private static VolumeCandidate renommer(VolumeCandidate candidate, String edition) {
        return new VolumeCandidate(edition, candidate.volumeNumber(), candidate.imageUrl(), candidate.title(),
                candidate.isbn(), candidate.annee());
    }

    private static String prefixeIsbn(VolumeCandidate candidate) {
        String isbn = candidate.isbnNormalise();
        return isbn == null || isbn.length() < LONGUEUR_PREFIXE_ISBN ? null : isbn.substring(0, LONGUEUR_PREFIXE_ISBN);
    }
}
