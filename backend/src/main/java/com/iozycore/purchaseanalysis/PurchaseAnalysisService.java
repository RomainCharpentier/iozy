package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import com.iozycore.insights.CollectionProgress;
import com.iozycore.insights.CollectionProgressService;

import java.util.TreeSet;
import java.util.UUID;

/**
 * Entry point of the Purchase Analysis feature - reads {@code catalog}
 * (via {@link SeriesMatcher}) purely for best-effort series resolution,
 * never writes to it, and orchestrates {@link PurchaseAnalysisEngine} with
 * data resolved from this module's own repositories.
 */
@Service
public class PurchaseAnalysisService {

    private final MangaEditionRepository mangaEditionRepository;
    private final MarketPriceObservationRepository marketPriceObservationRepository;
    private final PurchaseAnalysisRepository purchaseAnalysisRepository;
    private final CollectorPreferencesRepository collectorPreferencesRepository;
    private final SeriesMatcher seriesMatcher;
    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final AiEditionAdvisor aiEditionAdvisor;
    private final AiMarketPriceAdvisor aiMarketPriceAdvisor;
    private final CollectionProgressService progressService;
    private final com.iozycore.domain.wishlist.WishlistEntryRepository wishlistEntryRepository;
    private final PurchaseAnalysisEngine engine = new PurchaseAnalysisEngine();
    private final MarketPriceCalculator marketPriceCalculator = new MarketPriceCalculator();
    private final CompletenessCalculator completenessCalculator = new CompletenessCalculator();

    public PurchaseAnalysisService(MangaEditionRepository mangaEditionRepository,
                                    MarketPriceObservationRepository marketPriceObservationRepository,
                                    PurchaseAnalysisRepository purchaseAnalysisRepository,
                                    CollectorPreferencesRepository collectorPreferencesRepository,
                                    EntityRepository entityRepository,
                                    EntityTypeRepository entityTypeRepository,
                                    OwnershipRepository ownershipRepository,
                                    AiEditionAdvisor aiEditionAdvisor,
                                    AiMarketPriceAdvisor aiMarketPriceAdvisor,
                                    CollectionProgressService progressService,
                                    com.iozycore.domain.wishlist.WishlistEntryRepository wishlistEntryRepository) {
        this.mangaEditionRepository = mangaEditionRepository;
        this.marketPriceObservationRepository = marketPriceObservationRepository;
        this.purchaseAnalysisRepository = purchaseAnalysisRepository;
        this.collectorPreferencesRepository = collectorPreferencesRepository;
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.aiEditionAdvisor = aiEditionAdvisor;
        this.aiMarketPriceAdvisor = aiMarketPriceAdvisor;
        this.progressService = progressService;
        this.seriesMatcher = new SeriesMatcher(entityRepository, entityTypeRepository);
    }

    /** One series within an {@link AnalyzeListingCommand} - see {@link ListingItem} for field semantics. */
    public record AnalyzeListingItemCommand(String seriesTitle, String editionName, Set<Integer> includedVolumes,
                                             Condition itemConditionOverride) {
    }

    /**
     * @param externalListingId identifiant de l'annonce chez la source, quand la lecture du lien
     *                          l'a donné. Sert uniquement à reconnaître deux analyses de la MEME
     *                          annonce (voir {@link ListingIdentity}) - jamais affiché, jamais
     *                          conservé dans l'analyse elle-même.
     */
    public record AnalyzeListingCommand(ListingPlatform platform, String url, String rawTitle, String description, BigDecimal askingPrice,
                                         BigDecimal shippingFee, com.iozycore.listing.ShippingEstimateKind shippingKind,
                                         BigDecimal buyerProtectionFee, Condition condition,
                                         boolean conditionAppliesToContainer, List<AnalyzeListingItemCommand> items,
                                         List<String> photoUrls, String externalListingId) {

        /** Appelants qui n'ont pas d'identifiant de source - saisie entierement manuelle, et la plupart des tests. */
        public AnalyzeListingCommand(ListingPlatform platform, String url, String rawTitle, String description,
                                      BigDecimal askingPrice, BigDecimal shippingFee,
                                      com.iozycore.listing.ShippingEstimateKind shippingKind,
                                      BigDecimal buyerProtectionFee, Condition condition,
                                      boolean conditionAppliesToContainer, List<AnalyzeListingItemCommand> items,
                                      List<String> photoUrls) {
            this(platform, url, rawTitle, description, askingPrice, shippingFee, shippingKind, buyerProtectionFee,
                    condition, conditionAppliesToContainer, items, photoUrls, null);
        }
    }

    @Transactional
    public PurchaseAnalysis analyze(AnalyzeListingCommand command) {
        List<ListingItem> listingItems = new ArrayList<>();
        List<PurchaseAnalysisEngine.ItemContext> itemContexts = new ArrayList<>();

        for (AnalyzeListingItemCommand itemCommand : command.items()) {
            MangaSeries series = seriesMatcher.match(itemCommand.seriesTitle());
            ListingItem item = new ListingItem(series, itemCommand.editionName(), itemCommand.includedVolumes(),
                    itemCommand.itemConditionOverride());
            listingItems.add(item);

            final Optional<MangaEdition> matchedEdition =
                    findEdition(series.knownEntityId(), series.title(), itemCommand.editionName());
            List<MangaEdition> siblingEditions = findEditionsForSeries(series.knownEntityId(), series.title()).stream()
                    .filter(edition -> matchedEdition.isEmpty() || !edition.id().equals(matchedEdition.get().id()))
                    .toList();
            List<MarketPriceObservation> observations = matchedEdition
                    .map(edition -> marketPriceObservationRepository.findByEditionId(edition.id()))
                    .orElseGet(List::of);

            // "Analyse d'un lot" (brainstorm) - jamais deviné : vide tant que la série
            // n'est pas reconnue dans le catalogue (series.knownEntityId() == null).
            Set<Integer> alreadyOwnedVolumes = series.knownEntityId() != null
                    ? findOwnedVolumeNumbers(series.knownEntityId(), itemCommand.editionName())
                    : Set.of();

            // Phase 2 (assistance IA) - seulement quand il n'existe aucune observation réelle : la
            // donnée réelle a toujours priorité, l'IA ne fait que combler l'absence de données, jamais
            // les compléter/contredire (voir AiMarketPriceAdvisor).
            AiPriceEstimate aiEstimate = observations.isEmpty()
                    ? aiMarketPriceAdvisor.estimateMarketPrice(series.title(), itemCommand.editionName(),
                            itemCommand.itemConditionOverride() != null ? itemCommand.itemConditionOverride() : command.condition())
                            .orElse(null)
                    : null;

            itemContexts.add(new PurchaseAnalysisEngine.ItemContext(
                    item, matchedEdition.orElse(null), siblingEditions, observations, alreadyOwnedVolumes, aiEstimate));
        }

        Listing listing = new Listing(UUID.randomUUID(), command.platform(), command.url(), command.rawTitle(),
                command.description(), command.askingPrice(), command.shippingFee(), command.shippingKind(),
                command.buyerProtectionFee(),
                command.condition(), command.conditionAppliesToContainer(), listingItems, command.photoUrls(),
                java.time.Instant.now());

        CollectorPreferences preferences = collectorPreferencesRepository.find();
        // Les envies sont lues ICI : le moteur reste un domaine pur, il recoit
        // un nombre. Vouloir une oeuvre n'est pas la posseder - ce compte ne
        // retire donc rien aux manquants, il qualifie leur interet.
        // L'identite est etablie AVANT le calcul : elle sert d'abord a exclure
        // de la reference les releves issus de cette meme annonce, analysee une
        // fois deja. Sans quoi une reanalyse se comparerait a son propre prix.
        String identiteAnnonce = ListingIdentity.of(command.platform(), command.externalListingId(), command.url());

        PurchaseAnalysis analysis = engine.analyze(listing, itemContexts, preferences,
                comptePresentDansLesEnvies(itemContexts), identiteAnnonce);
        PurchaseAnalysis enregistree = purchaseAnalysisRepository.save(analysis);

        // APRES seulement : le prix demande rejoint les releves de marche. Le
        // moment compte - a ce stade l'utilisateur a corrige la serie, choisi
        // l'edition et valide la composition, donc le releve porte sur un
        // produit reellement identifie plutot que sur un brouillon.
        releverLePrixDemande(enregistree, identiteAnnonce);
        return enregistree;
    }

    /**
     * Retient le prix demande d'une annonce analysee comme un prix de marche.
     *
     * <h2>Ce qui est enregistre, et ce qui ne l'est pas</h2>
     * Le prix de l'annonce, <b>hors frais</b>. Protection acheteur et livraison
     * appartiennent au cout d'acquisition de l'acheteur, pas a ce que vaut le
     * produit : les inclure ici comparerait plus tard des annonces hors frais a
     * des totaux frais compris.
     *
     * <h2>Quatre refus</h2>
     * <ul>
     *   <li><b>Lot multi-series</b> : le prix couvre l'ensemble, et le repartir
     *       au prorata fabriquerait un prix que personne n'a jamais demande.</li>
     *   <li><b>Edition non identifiee</b> : un releve doit se rattacher a un
     *       produit. « Lot manga divers » ne produit rien - mieux vaut aucune
     *       reference qu'une reference mal rattachee.</li>
     *   <li><b>Composition inconnue</b> : sans nombre de tomes, la forme du lot
     *       est indeterminable, donc le releve incomparable.</li>
     *   <li><b>Prix nul</b> : rien a observer.</li>
     * </ul>
     * Ni estimation IA ni prix neuf catalogue n'arrivent jamais ici : cette
     * methode ne lit que le prix demande de l'annonce.
     */
    private void releverLePrixDemande(PurchaseAnalysis analysis, String identiteAnnonce) {
        Listing listing = analysis.listing();
        if (analysis.itemBreakdown().size() != 1 || listing.askingPrice().signum() <= 0) {
            return;
        }
        ItemAnalysis item = analysis.itemBreakdown().get(0);
        MangaEdition edition = item.matchedEdition();
        Set<Integer> tomes = item.item().includedVolumes();
        if (edition == null || tomes.isEmpty()) {
            return;
        }
        if (!LotShape.of(tomes.size(), edition.totalVolumes()).isComparable()) {
            return;
        }

        LocalDate observeLe = LocalDate.ofInstant(analysis.requestedAt(), java.time.ZoneId.systemDefault());
        // Rien de neuf a dire : la meme annonce, au meme prix, deja relevee. Une
        // ligne de plus ne serait pas une observation supplementaire du marche.
        if (identiteAnnonce != null && dejaReleveAuMemePrix(edition.id(), identiteAnnonce, listing.askingPrice())) {
            return;
        }

        Condition etat = item.item().itemConditionOverride() != null
                ? item.item().itemConditionOverride()
                : listing.condition();
        // La portee reste la plage couverte, pour l'affichage ; c'est
        // volumeCount qui fait foi, un lot pouvant etre discontinu.
        VolumeRange portee = new VolumeRange(java.util.Collections.min(tomes), java.util.Collections.max(tomes));
        marketPriceObservationRepository.save(MarketPriceObservation.fromAnalyzedListing(
                edition.id(), portee, tomes.size(), listing.askingPrice(), listing.platform(),
                etat, observeLe, identiteAnnonce, listing.url()));
    }

    /**
     * Vrai quand le dernier releve connu de cette annonce affichait deja ce
     * prix. Un prix different, lui, est enregistre : une annonce passee de 70 a
     * 60 EUR dit quelque chose du marche, et l'historique le conserve - sans
     * pour autant compter pour deux vendeurs, le regroupement par annonce s'en
     * chargeant a la lecture.
     */
    private boolean dejaReleveAuMemePrix(UUID editionId, String identiteAnnonce, BigDecimal prix) {
        return marketPriceObservationRepository.findByEditionId(editionId).stream()
                .filter(observation -> identiteAnnonce.equals(observation.listingIdentity()))
                .max(java.util.Comparator.comparing(MarketPriceObservation::observedAt)
                        .thenComparing(MarketPriceObservation::createdAt))
                .filter(dernier -> dernier.observedPrice().compareTo(prix) == 0)
                .isPresent();
    }

    /**
     * Les tomes du lot qui manquent ET dont la série est déjà dans les envies.
     * <p>
     * La wishlist d'IozyCore porte sur l'ŒUVRE, pas sur le tome : « je cherche
     * Vinland Saga », pas « je cherche le tome 7 ». On compte donc les tomes
     * manquants des séries souhaitées - ce sont eux que ce lot vient combler,
     * et c'est ce qui distingue un lot utile d'un lot activement recherché.
     * <p>
     * Ce compte ne retire rien aux manquants et n'en ajoute pas : vouloir n'est
     * pas posséder, il qualifie leur intérêt sans changer leur nombre.
     */
    private int comptePresentDansLesEnvies(List<PurchaseAnalysisEngine.ItemContext> contextes) {
        Set<UUID> souhaitees = wishlistEntryRepository.findAll().stream()
                .map(com.iozycore.domain.wishlist.WishlistEntry::entityId)
                .collect(java.util.stream.Collectors.toSet());
        if (souhaitees.isEmpty()) {
            return 0;
        }
        int total = 0;
        for (PurchaseAnalysisEngine.ItemContext contexte : contextes) {
            UUID entityId = contexte.item().series().knownEntityId();
            if (entityId == null || !souhaitees.contains(entityId)) {
                continue;
            }
            for (Integer tome : contexte.item().includedVolumes()) {
                if (!contexte.alreadyOwnedVolumes().contains(tome)) {
                    total++;
                }
            }
        }
        return total;
    }

    public List<PurchaseAnalysis> history() {
        return purchaseAnalysisRepository.findAll();
    }

    public Optional<PurchaseAnalysis> findAnalysisById(UUID id) {
        return purchaseAnalysisRepository.findById(id);
    }

    /**
     * Retire une analyse de l'historique, et rien d'autre : les prix relevés et
     * les éditions de référence renseignés au fil de cette analyse survivent -
     * ce sont des données de référence qui servent toutes les analyses
     * suivantes, pas des sous-objets de celle-ci.
     */
    public void deleteAnalysis(UUID id) {
        purchaseAnalysisRepository.deleteById(id);
    }

    /** Les relevés d'une édition, pour pouvoir les relire et en retirer un faux. */
    public List<MarketPriceObservation> observationsOfEdition(UUID mangaEditionId) {
        return marketPriceObservationRepository.findByEditionId(mangaEditionId);
    }

    /**
     * Retire un relevé de prix saisi par erreur. Les analyses déjà enregistrées
     * ne changent pas : chacune fige ses propres chiffres au moment du calcul.
     * Ce sont les analyses SUIVANTES qui cesseront de compter ce relevé.
     */
    public void deleteMarketObservation(UUID id) {
        marketPriceObservationRepository.deleteById(id);
    }

    /**
     * {@code entityId} (voir migration "Série -> Édition par ID", historique de la conversation) est
     * désormais la source de vérité une fois connue : recherche par ID d'abord, jamais reconsultée via
     * {@code seriesTitle} pour une édition déjà rattachée - immunisé contre un renommage de Série
     * survenu depuis (voir {@code Entity.rename}, {@code seriesTitle} sur {@link MangaEdition} n'est
     * alors qu'une donnée figée à sa création, jamais mise à jour en cascade).
     * <p>
     * Le repli texte ({@code seriesTitle}) ne sert plus que pour les deux cas où l'ID ne suffit pas :
     * {@code entityId} inconnu de l'appelant (ex: Analyse d'achat sur une série pas encore en
     * collection), ou édition trouvée par titre mais pas encore rattachée (ancien enregistrement) -
     * dans ce dernier cas, rattachée ici même, best-effort, avant d'être renvoyée (voir
     * {@link #linkToKnownEntityIfNeeded}) : le prochain appel passera directement par l'ID.
     */
    public Optional<MangaEdition> findEdition(UUID entityId, String seriesTitle, String editionName) {
        if (entityId != null) {
            Optional<MangaEdition> byId = mangaEditionRepository.findByEntityIdAndEditionName(entityId, editionName);
            if (byId.isPresent()) {
                return byId;
            }
        }
        Optional<MangaEdition> byTitle = mangaEditionRepository.findBySeriesAndEdition(seriesTitle, editionName);
        return byTitle.map(edition -> linkToKnownEntityIfNeeded(edition, entityId));
    }

    /** Lecture par identifiant - utilisée avant une suppression, pour distinguer
     * "cette édition n'existe pas" (404) de "elle existe mais est encore
     * utilisée" (409). */
    public Optional<MangaEdition> findEditionById(UUID editionId) {
        return mangaEditionRepository.findById(editionId);
    }

    /**
     * Ce qui retient encore une édition de référence et empêche sa suppression.
     * Aucun blocage = elle a bien été supprimée.
     */
    public record EditionDeletionBlockers(int linkedVolumes, int linkedObservations) {
        public boolean none() {
            return linkedVolumes == 0 && linkedObservations == 0;
        }
    }

    /**
     * Supprime une édition de référence - REFUSÉE tant qu'un Tome y est encore
     * rattaché (Variant.mangaEditionId) OU qu'une observation de prix s'y
     * réfère, pour ne jamais laisser derrière soi une ligne pointant vers une
     * édition disparue. Même parti pris que la suppression d'un EntityType
     * (voir EntityTypeService) : on explique ce qui bloque plutôt que de délier
     * en silence des données que l'utilisateur croyait liées.
     * <p>
     * Les observations manquaient à cet inventaire : la contrainte de clé
     * étrangère de Postgres restait alors seule à protéger la table, et
     * remontait une erreur SQL brute en 500 au lieu du 409 explicite prévu
     * ici (constaté en vérification, Lot 26).
     *
     * @return ce qui bloque, ou des compteurs à zéro quand la suppression a
     *         bien eu lieu.
     */
    public EditionDeletionBlockers deleteEdition(UUID editionId) {
        long linkedVolumes = entityRepository.search(null, null, null).stream()
                .flatMap(entity -> entity.variants().stream())
                .filter(variant -> editionId.equals(variant.mangaEditionId()))
                .count();
        int linkedObservations = marketPriceObservationRepository.findByEditionId(editionId).size();
        if (linkedVolumes > 0 || linkedObservations > 0) {
            return new EditionDeletionBlockers((int) linkedVolumes, linkedObservations);
        }
        mangaEditionRepository.deleteById(editionId);
        return new EditionDeletionBlockers(0, 0);
    }

    /** Toutes les éditions connues, toutes séries confondues - pour un écran qui
     * affiche la progression de PLUSIEURS séries d'un coup (Ma collection) sans
     * un appel par tuile. Aucun filtrage/enrichissement : c'est une lecture
     * brute du référentiel, volontairement distincte de {@link #findEdition},
     * qui elle rattache opportunément une édition à une Série. */
    public List<MangaEdition> findAllEditions() {
        return mangaEditionRepository.findAll();
    }

    /** Même principe que {@link #findEdition} : par ID quand connu (jamais de repli texte dans ce cas,
     * contrairement à {@link #findEdition} - une liste "toutes les éditions rattachées" n'a pas de
     * raison de se compléter avec un résultat de correspondance textuelle une fois l'ID disponible). */
    public List<MangaEdition> findEditionsForSeries(UUID entityId, String seriesTitle) {
        if (entityId != null) {
            return mangaEditionRepository.findByEntityId(entityId);
        }
        return mangaEditionRepository.findBySeriesTitle(seriesTitle);
    }

    /**
     * "Assistance IA" (Phase 2, project memory) - a best-effort draft for an
     * edition unknown to the system, to pre-fill the manual-entry form
     * instead of leaving it blank. Deliberately read-only: never calls
     * {@link MangaEditionRepository#save}, the user must still submit
     * {@link #createEdition} themselves after reviewing it.
     */
    public Optional<EditionSuggestion> suggestEditionReferenceData(String seriesTitle, String editionName) {
        return aiEditionAdvisor.suggestReferenceData(seriesTitle, editionName);
    }

    /**
     * "Coût pour compléter une série" (Ma collection) - same completeness
     * engine as a listing being evaluated (see CompletenessCalculator),
     * applied instead to a series already in the user's own collection.
     * {@code editionName} is expected already resolved (e.g. from a
     * Variant's "edition" attribute) - unknown to the system yet simply
     * means the returned {@link CollectionStatus} is unknown, never guessed.
     */
    public CollectionStatus computeCompleteness(UUID entityId, String seriesTitle, String editionName, Set<Integer> includedVolumes) {
        return computeCompleteness(entityId, seriesTitle, editionName, includedVolumes, Set.of());
    }

    /**
     * @param cataloguedVolumes étape 6/8 (modèle Tome != Ownership) - volume numbers that have a real
     *                          catalogued Variant regardless of Ownership, so the response can
     *                          distinguish "missing but already catalogued" from "missing and purely
     *                          virtual" (see {@link CollectionStatus#cataloguedMissingVolumeNumbers()}) -
     *                          empty when the caller doesn't have/need that distinction.
     */
    public CollectionStatus computeCompleteness(UUID entityId, String seriesTitle, String editionName, Set<Integer> includedVolumes,
                                                 Set<Integer> cataloguedVolumes) {
        Optional<MangaEdition> edition = findEdition(entityId, seriesTitle, editionName);
        List<MarketPriceObservation> observations = edition
                .map(e -> marketPriceObservationRepository.findByEditionId(e.id()))
                .orElseGet(List::of);
        MarketPrice perVolumeMarketPrice = marketPriceCalculator.computePerVolume(edition.orElse(null), observations);
        return completenessCalculator.compute(includedVolumes, cataloguedVolumes, edition.orElse(null), perVolumeMarketPrice);
    }

    /**
     * "Suggestions d'achats" (Mon profil) - séries déjà en collection dont
     * une édition nommée est connue mais pas complète, triées par nombre de
     * tomes manquants croissant (les plus proches de la complétion en
     * premier). Une série sans édition nommée sur ses tomes (attribut
     * "edition" absent/vide) n'a rien à rattacher dans manga_edition et est
     * donc silencieusement ignorée ici, comme pour la détection d'éditions
     * mélangées côté web (voir groupVariantsByEdition côté web/editionGroups.ts).
     * <p>
     * {@code ownedCount}/{@code missingVolumeNumbers} mesurent la possession réelle
     * (Ownership active), jamais la simple existence catalogue d'un Variant (étape 6,
     * modèle Tome ≠ Ownership) - un tome revendu ou dont l'Ownership a été supprimée
     * (voir OwnershipDeletionService) redevient "manquant" ici même si son Variant
     * catalogué existe toujours. {@code cataloguedMissingVolumeNumbers} distingue,
     * parmi les tomes manquants, ceux qui sont déjà catalogués (un Variant existe,
     * juste sans Ownership - potentiellement enrichissable via merge-attributes sans
     * jamais créer de doublon) de ceux purement virtuels (aucun Variant, seulement un
     * numéro déduit de totalVolumes).
     */
    public record NearCompleteSuggestion(UUID entityId, String seriesTitle, String editionName, int ownedCount,
                                          int totalVolumes, int missingCount, List<Integer> missingVolumeNumbers,
                                          List<Integer> cataloguedMissingVolumeNumbers,
                                          BigDecimal estimatedCostToComplete, PriceBasis costToCompleteBasis) {
    }

    public List<NearCompleteSuggestion> findNearCompleteSuggestions() {
        Optional<EntityType> mangaType = entityTypeRepository.findByCode("MANGA");
        if (mangaType.isEmpty()) {
            return List.of();
        }
        List<Entity> mangaEntities = entityRepository.findAllByType(mangaType.get().id());

        List<NearCompleteSuggestion> suggestions = new ArrayList<>();
        for (Entity entity : mangaEntities) {
            // Les groupes et le possédé viennent de CollectionProgressService, source
            // unique de la progression : ce moteur les recalculait pour son compte et
            // ignorait les tomes sans édition précisée, d'où une série annoncée 2/72
            // ici et 3/72 sur Ma collection (audit du 2026-08-21, Lot 31).
            for (CollectionProgress.EditionProgress group : progressService.compute(entity.id())
                    .map(CollectionProgress::editions).orElse(List.of())) {
                String editionName = group.editionName();
                if (editionName.isEmpty()) {
                    continue; // sans édition nommée, rien à confronter à manga_edition
                }
                Set<Integer> cataloguedVolumes = new TreeSet<>(group.cataloguedVolumeNumbers());
                Set<Integer> ownedVolumes = new TreeSet<>(group.ownedVolumeNumbers());
                CollectionStatus status = computeCompleteness(entity.id(), entity.title(), editionName, ownedVolumes, cataloguedVolumes);
                if (status.isKnown() && !status.isComplete()) {
                    suggestions.add(new NearCompleteSuggestion(entity.id(), entity.title(), editionName,
                            ownedVolumes.size(), status.totalVolumes(), status.missingCount(),
                            status.missingVolumeNumbers(), status.cataloguedMissingVolumeNumbers(),
                            status.estimatedCostToComplete(), status.costToCompleteBasis()));
                }
            }
        }
        suggestions.sort(Comparator.comparingInt(NearCompleteSuggestion::missingCount));
        return suggestions;
    }

    /**
     * "Analyse d'un lot" - tomes de cette édition actuellement possédés (ownership active
     * uniquement : un tome revendu/perdu n'est plus un doublon si on le rachète).
     * <p>
     * Passe par {@link CollectionProgressService}, source UNIQUE de la progression, comme
     * les suggestions ci-dessus. Cette méthode refaisait le calcul pour son compte et
     * exigeait que l'attribut {@code edition} du tome corresponde EXACTEMENT : un tome
     * catalogué sans édition précisée n'était donc compté dans aucune édition. Partout
     * ailleurs il rejoint l'unique édition nommée de la série (voir resolveEditionView côté
     * web, et le regroupement de CollectionProgressService côté serveur).
     * <p>
     * Conséquence constatée en éprouvant le parcours le 2026-08-27 : la fiche de Naruto
     * annonçait le tome 1 possédé dans l'édition Kana, et l'analyse d'un lot "Naruto 1-5"
     * répondait "5 manquants" - elle conseillait donc de racheter un tome déjà en rayon,
     * ce qui est l'inverse de ce que cet écran sert à faire. Même défaut, même fichier,
     * que celui corrigé au Lot 31 pour les suggestions - corrigé là, pas ici.
     * <p>
     * Jamais deviné : ensemble vide si l'Entity a disparu depuis la résolution du
     * knownEntityId, ou si aucun groupe ne porte cette édition.
     */
    private Set<Integer> findOwnedVolumeNumbers(UUID entityId, String editionName) {
        String recherchee = editionName == null ? "" : editionName.trim();
        return progressService.compute(entityId)
                .map(CollectionProgress::editions)
                .orElse(List.of())
                .stream()
                .filter(groupe -> groupe.editionName().equalsIgnoreCase(recherchee))
                .findFirst()
                .<Set<Integer>>map(groupe -> new TreeSet<>(groupe.ownedVolumeNumbers()))
                .orElseGet(Set::of);
    }

    /** Server-side equivalent of the web's groupVariantsByEdition (editionGroups.ts) - variants
     * without both a numeric "volumeNumber" and a non-blank "edition" attribute are excluded,
     * since a suggestion needs a named edition to look up against manga_edition. */
    private static Map<String, Set<Integer>> groupVolumesByEdition(Entity entity) {
        Map<String, Set<Integer>> byEdition = new LinkedHashMap<>();
        for (Variant variant : entity.variants()) {
            Object volumeNumberObj = variant.attributes().get("volumeNumber");
            if (!(volumeNumberObj instanceof Number number)) {
                continue;
            }
            Object editionObj = variant.attributes().get("edition");
            String edition = editionObj instanceof String s ? s.trim() : "";
            if (edition.isEmpty()) {
                continue;
            }
            byEdition.computeIfAbsent(edition, k -> new TreeSet<>()).add(number.intValue());
        }
        return byEdition;
    }

    /**
     * @param entityId l'appelant peut fournir directement l'ID de la Série (ex: fiche Série, qui la
     *                 connaît déjà avec certitude) - utilisé tel quel, sans passer par SeriesMatcher.
     *                 {@code null} (ex: Analyse d'achat sur une série pas nécessairement en collection)
     *                 retombe sur le matching texte best-effort existant.
     */
    public MangaEdition createEdition(UUID entityId, String seriesTitle, String editionName, EditionTier tier, String publisher,
                                       Integer totalVolumes, BigDecimal retailPriceNewPerVolume, boolean outOfPrint,
                                       boolean betterEditionAnnounced, String betterEditionNote) {
        // Une Série fournie explicitement doit exister. Sans ce contrôle, seule la
        // contrainte de clé étrangère protégeait la table, et le client recevait
        // « Cette donnée entre en conflit avec une donnée existante » - alors que
        // la Série est ABSENTE, pas conflictuelle.
        //
        // 400 et non 404, comme les quatre autres routes qui référencent une
        // œuvre depuis un CORPS de requête (/experiences, /wishlist,
        // /relationships, /edition-upgrade-wishes). La ressource visée -
        // POST /editions - existe bel et bien ; c'est la référence fournie qui
        // est invalide. Et le client remplace le message de tout 404 par un
        // repli générique : en 404, « Série introuvable » n'atteindrait jamais
        // l'écran.
        if (entityId != null && entityRepository.findById(entityId).isEmpty()) {
            throw new IllegalArgumentException("Série introuvable : " + entityId);
        }
        // Modèle catalogue cible (Série -> Édition -> Tome) : si cette série est déjà une Entity
        // connue, lie l'édition dès sa création plutôt que d'attendre une prochaine analyse.
        UUID linkedEntityId = entityId != null ? entityId : seriesMatcher.match(seriesTitle).knownEntityId();
        MangaEdition edition = MangaEdition.create(linkedEntityId, seriesTitle, editionName, tier, publisher,
                totalVolumes, retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote);
        return mangaEditionRepository.save(edition);
    }

    /**
     * Le matching texte ({@link SeriesMatcher}, comparaison de titres) reste le mécanisme de
     * résolution à l'usage, mais la relation persistante cible est bien {@code manga_edition.entity_id}
     * une fois connue - dès qu'une édition déjà enregistrée est utilisée aux côtés d'une Entity
     * elle-même déjà résolue, le lien est enregistré une bonne fois pour toutes plutôt que
     * rematché à chaque appel. Jamais l'inverse : n'invente/ne force jamais un entityId sans un
     * match déjà établi ailleurs (ici, par {@link SeriesMatcher}).
     */
    private MangaEdition linkToKnownEntityIfNeeded(MangaEdition edition, UUID knownEntityId) {
        if (edition.entityId() != null || knownEntityId == null) {
            return edition;
        }
        return mangaEditionRepository.save(edition.withEntityId(knownEntityId));
    }

    public MangaEdition updateEdition(UUID id, EditionTier tier, String publisher, Integer totalVolumes,
                                       BigDecimal retailPriceNewPerVolume, Boolean outOfPrint,
                                       Boolean betterEditionAnnounced, String betterEditionNote) {
        MangaEdition existing = mangaEditionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Édition introuvable : " + id));
        MangaEdition updated = existing.withUpdatedReferenceData(tier, publisher, totalVolumes,
                retailPriceNewPerVolume, outOfPrint, betterEditionAnnounced, betterEditionNote);
        return mangaEditionRepository.save(updated);
    }

    public MarketPriceObservation recordMarketObservation(UUID mangaEditionId, VolumeRange scope,
                                                            BigDecimal observedPrice, ListingPlatform platform,
                                                            Condition observedCondition, LocalDate observedAt,
                                                            String note) {
        mangaEditionRepository.findById(mangaEditionId)
                .orElseThrow(() -> new IllegalArgumentException("Édition introuvable : " + mangaEditionId));
        MarketPriceObservation observation = MarketPriceObservation.record_(
                mangaEditionId, scope, observedPrice, platform, observedCondition, observedAt, note);
        return marketPriceObservationRepository.save(observation);
    }

    /** Édition existante portant ce couple (titre de série, nom d'édition) - la
     * contrainte d'unicité de la base porte exactement sur ce couple, quel que
     * soit l'entityId. Sert à refuser un doublon avant l'insert (voir Lot 36). */
    public Optional<MangaEdition> findEditionBySeriesAndName(String seriesTitle, String editionName) {
        if (seriesTitle == null || editionName == null) {
            return Optional.empty();
        }
        return mangaEditionRepository.findBySeriesAndEdition(seriesTitle, editionName);
    }

    public CollectorPreferences preferences() {
        return collectorPreferencesRepository.find();
    }

    public CollectorPreferences updatePreferences(CollectorPreferences preferences) {
        return collectorPreferencesRepository.save(preferences);
    }
}
