package com.iozycore.integration.http;

import com.iozycore.application.CatalogEntityResolver;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.purchaseanalysis.Condition;
import com.iozycore.purchaseanalysis.ListingPlatform;
import com.iozycore.purchaseanalysis.MarketPriceObservation;
import com.iozycore.purchaseanalysis.MarketPriceObservationRepository;
import com.iozycore.purchaseanalysis.PurchaseAnalysisRepository;
import com.iozycore.purchaseanalysis.VolumeRange;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le contrat HTTP de {@code /api/purchase-analysis} - dix-huit routes, huit
 * mutations.
 *
 * <h2>Ce que ces tests ne font PAS</h2>
 * Ils ne rejouent pas le moteur. Les verdicts, les médianes, la comparabilité
 * marché, la sémantique de livraison et l'ingestion d'observations ont déjà
 * plus de cent cinquante tests de domaine et d'intégration. Cette surface avait
 * donc une <b>forte couverture fonctionnelle</b> et <b>aucune couverture
 * formelle de sa frontière HTTP</b> - deux couches différentes.
 *
 * <h2>Ce qu'ils protègent</h2>
 * Le passage : routage, désérialisation, liaison, traduction des exceptions en
 * status, et surtout <b>l'absence d'effet partiel</b>. Un lot dont un seul
 * élément est invalide ne doit rien laisser en base.
 *
 * <h2>Pourquoi c'était nécessaire ici aussi</h2>
 * Deux défauts de production ont été trouvés en écrivant ces tests, tous deux
 * invisibles depuis un test de domaine : un {@code trim()} sur un titre nul,
 * atteignable par deux portes distinctes, et une clé étrangère laissée arbitre
 * du contrat pour une Série absente.
 */
class PurchaseAnalysisHttpContractTest extends HttpContractTestBase {

    @Autowired
    private MangaEditionRepository mangaEditionRepository;

    @Autowired
    private MarketPriceObservationRepository observationRepository;

    @Autowired
    private PurchaseAnalysisRepository analysisRepository;

    @Autowired
    private CatalogEntityResolver catalogEntityResolver;

    private static final String BASE = "/api/purchase-analysis";

    private MangaEdition uneEdition(int tomes) {
        return mangaEditionRepository.save(MangaEdition.create(
                "Berserk " + UUID.randomUUID(), "Standard", EditionTier.STANDARD, "Glénat",
                tomes, new BigDecimal("8.50"), false, false, null));
    }

    /** Le corps d'analyse le plus simple qui soit valide - une série, un lot de tomes. */
    private String analyseDe(String serie, String prix, int... tomes) {
        StringBuilder volumes = new StringBuilder();
        for (int t : tomes) {
            volumes.append(volumes.length() == 0 ? "" : ",").append(t);
        }
        return "{\"platform\":\"VINTED\",\"rawTitle\":\"Lot de test\",\"askingPrice\":" + prix + ","
                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                + "\"items\":[{\"seriesTitle\":\"" + serie + "\",\"editionName\":\"Standard\","
                + "\"includedVolumes\":[" + volumes + "]}]}";
    }

    // ══════════════════════════════════════ POST /analyze - le cœur

    @Test
    void analyses_a_manual_listing_without_any_url_and_persists_it() throws Exception {
        MangaEdition edition = uneEdition(14);

        String corps = mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content(analyseDe(edition.seriesTitle(), "70", 1, 2, 3)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                // L'invariant produit : l'analyse ne dépend pas de Vinted. Aucune
                // URL n'est fournie ici, et le calcul aboutit quand même.
                .andExpect(jsonPath("$.listing.url").doesNotExist())
                .andExpect(jsonPath("$.listing.askingPrice").value(70))
                .andExpect(jsonPath("$.verdict").isNotEmpty())
                .andExpect(jsonPath("$.itemBreakdown.length()").value(1))
                .andExpect(jsonPath("$.assessment").exists())
                .andReturn().getResponse().getContentAsString();

        UUID id = UUID.fromString(objectMapper.readTree(corps).get("id").asText());
        assertThat(analysisRepository.findById(id)).isPresent();
    }

    @Test
    void carries_a_listing_snapshot_through_json_without_calling_vinted() throws Exception {
        MangaEdition edition = uneEdition(14);

        // Le JSON qu'enverrait le formulaire après lecture d'une annonce. Aucun
        // appel réseau : les valeurs sont posées directement.
        mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content("{\"platform\":\"VINTED\",\"url\":\"https://www.vinted.fr/items/123-lot\","
                                + "\"externalListingId\":\"123\",\"rawTitle\":\"Lot Berserk\","
                                + "\"description\":\"Bon état général\",\"askingPrice\":45,"
                                + "\"shippingFee\":3.78,\"shippingKind\":\"FROM\",\"buyerProtectionFee\":2.95,"
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"photoUrls\":[\"https://exemple.test/1.jpg\"],"
                                + "\"items\":[{\"seriesTitle\":\"" + edition.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":[1,2]}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.listing.url").value("https://www.vinted.fr/items/123-lot"))
                .andExpect(jsonPath("$.listing.shippingKind").value("FROM"))
                .andExpect(jsonPath("$.listing.buyerProtectionFee").value(2.95))
                .andExpect(jsonPath("$.listing.photoUrls.length()").value(1))
                // 45 + 2,95 + 3,78 : le coût d'acquisition, distinct du prix.
                .andExpect(jsonPath("$.totalRealCost").value(51.73));
    }

    @Test
    void normalises_an_unknown_shipping_kind_carrying_an_amount_into_an_estimate() throws Exception {
        MangaEdition edition = uneEdition(14);

        // La normalisation vit dans le domaine et y est testée ; ce qui se joue
        // ici, c'est qu'une requête HTTP la traverse bien.
        mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content("{\"platform\":\"VINTED\",\"rawTitle\":\"Lot\",\"askingPrice\":10,"
                                + "\"shippingFee\":5.90,\"shippingKind\":\"UNKNOWN\","
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"items\":[{\"seriesTitle\":\"" + edition.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":[1]}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.listing.shippingKind").value("ESTIMATED"))
                .andExpect(jsonPath("$.listing.shippingFee").value(5.90));
    }

    @Test
    void rejects_an_analysis_whose_item_has_no_series_title_with_400_instead_of_crashing() throws Exception {
        // Découvert par cette passe, et c'était un vrai 500 : SeriesMatcher
        // appelait trim() sur le titre avant toute garde. Deux portes menaient
        // au même défaut - celle-ci et la création d'édition.
        mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content("{\"platform\":\"VINTED\",\"rawTitle\":\"Lot\",\"askingPrice\":10,"
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"items\":[{\"editionName\":\"Standard\",\"includedVolumes\":[1]}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void a_lot_whose_second_item_is_invalid_persists_nothing_at_all() throws Exception {
        MangaEdition edition = uneEdition(14);
        long avant = analysisRepository.findAll().size();

        // L'atomicité est le vrai enjeu : un lot à moitié écrit laisserait une
        // analyse dont le verdict ne correspond à rien de ce qui a été demandé.
        mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content("{\"platform\":\"VINTED\",\"rawTitle\":\"Lot\",\"askingPrice\":40,"
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"items\":[{\"seriesTitle\":\"" + edition.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":[1]},"
                                + "{\"editionName\":\"Standard\",\"includedVolumes\":[2]}]}"))
                .andExpect(status().isBadRequest());

        assertThat(analysisRepository.findAll()).hasSize((int) avant);
    }

    @Test
    void analyses_a_multi_series_lot_and_keeps_one_breakdown_per_series() throws Exception {
        MangaEdition premiere = uneEdition(14);
        MangaEdition seconde = uneEdition(10);

        mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content("{\"platform\":\"VINTED\",\"rawTitle\":\"Deux séries\",\"askingPrice\":120,"
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"items\":[{\"seriesTitle\":\"" + premiere.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":[1,2]},"
                                + "{\"seriesTitle\":\"" + seconde.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":[1]}]}"))
                .andExpect(status().isCreated())
                // La collection est désérialisée et associée dans l'ordre reçu.
                .andExpect(jsonPath("$.itemBreakdown.length()").value(2))
                .andExpect(jsonPath("$.itemBreakdown[0].item.series.title").value(premiere.seriesTitle()))
                .andExpect(jsonPath("$.itemBreakdown[1].item.series.title").value(seconde.seriesTitle()));
    }

    @Test
    void rejects_an_analysis_body_that_cannot_produce_a_listing_with_400_and_never_500() throws Exception {
        MangaEdition edition = uneEdition(14);
        String serie = edition.seriesTitle();

        for (String corps : new String[] {
                "{}", "", "{pas du json",
                // Lot vide, prix absent, prix négatif, prix non numérique.
                "{\"platform\":\"VINTED\",\"rawTitle\":\"x\",\"askingPrice\":10,\"condition\":\"VERY_GOOD\",\"items\":[]}",
                analyseDe(serie, "null", 1),
                analyseDe(serie, "-5", 1),
                analyseDe(serie, "\"bonjour\"", 1)}) {
            mockMvc.perform(post(BASE + "/analyze").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void rejects_unknown_enum_values_in_an_analysis_with_400() throws Exception {
        MangaEdition edition = uneEdition(14);
        String base = "{\"platform\":\"%s\",\"rawTitle\":\"x\",\"askingPrice\":10,\"condition\":\"%s\","
                + "\"shippingKind\":\"%s\",\"conditionAppliesToContainer\":false,"
                + "\"items\":[{\"seriesTitle\":\"" + edition.seriesTitle() + "\",\"editionName\":\"Standard\","
                + "\"includedVolumes\":[1]}]}";

        for (String corps : new String[] {
                base.formatted("MAGIC", "VERY_GOOD", "FROM"),
                base.formatted("VINTED", "MAGIC", "FROM"),
                base.formatted("VINTED", "VERY_GOOD", "MAGIC")}) {
            mockMvc.perform(post(BASE + "/analyze").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }

    // ══════════════════════════ Ingestion d'observation, un cas fort

    @Test
    void a_saved_analysis_records_the_asking_price_as_a_market_observation_never_the_total_cost()
            throws Exception {
        MangaEdition edition = uneEdition(14);

        mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content("{\"platform\":\"VINTED\",\"url\":\"https://www.vinted.fr/items/999\","
                                + "\"externalListingId\":\"999\",\"rawTitle\":\"Lot\",\"askingPrice\":45,"
                                + "\"shippingFee\":3.78,\"shippingKind\":\"FROM\",\"buyerProtectionFee\":2.95,"
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"items\":[{\"seriesTitle\":\"" + edition.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":"
                                + "[1,2,3,4,5,6,7,8,9,10,11,12,13,14]}]}"))
                .andExpect(status().isCreated());

        MarketPriceObservation releve = observationRepository.findByEditionId(edition.id()).get(0);
        // LE point : le marché retient le prix de l'annonce, jamais le coût
        // d'acquisition (45 + 2,95 + 3,78 = 51,73). Les frais sont ceux de
        // l'acheteur, pas la valeur du produit.
        assertThat(releve.observedPrice()).isEqualByComparingTo("45");
        assertThat(releve.observedPrice()).isNotEqualByComparingTo("51.73");
        assertThat(releve.listingIdentity()).isEqualTo("VINTED:999");
    }

    @Test
    void a_multi_series_lot_creates_no_market_observation_but_is_still_analysed() throws Exception {
        MangaEdition premiere = uneEdition(14);
        MangaEdition seconde = uneEdition(10);

        mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content("{\"platform\":\"VINTED\",\"rawTitle\":\"Deux séries\",\"askingPrice\":120,"
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"items\":[{\"seriesTitle\":\"" + premiere.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":[1,2]},"
                                + "{\"seriesTitle\":\"" + seconde.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":[1]}]}"))
                .andExpect(status().isCreated());

        // Le prix couvre l'ensemble : le répartir fabriquerait un prix que
        // personne n'a demandé. L'analyse vit, l'observation non.
        assertThat(observationRepository.findByEditionId(premiere.id())).isEmpty();
        assertThat(observationRepository.findByEditionId(seconde.id())).isEmpty();
    }

    // ═══════════════════════════════════════════ Historique : lire, supprimer

    @Test
    void lists_and_reads_back_a_saved_analysis_then_deletes_it_idempotently() throws Exception {
        MangaEdition edition = uneEdition(14);
        String corps = mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content(analyseDe(edition.seriesTitle(), "70", 1, 2)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(objectMapper.readTree(corps).get("id").asText());

        mockMvc.perform(get(BASE + "/history"))
                .andExpect(status().isOk())
                // La liste est une projection allégée : elle porte le verdict et
                // le coût, pas le détail complet.
                .andExpect(jsonPath("$[?(@.id=='" + id + "')].totalRealCost").exists())
                .andExpect(jsonPath("$[?(@.id=='" + id + "')].verdict").exists());

        mockMvc.perform(get(BASE + "/history/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.listing.rawTitle").value("Lot de test"))
                .andExpect(jsonPath("$.itemBreakdown[0].item.series.title").value(edition.seriesTitle()));

        mockMvc.perform(delete(BASE + "/history/{id}", id)).andExpect(status().isNoContent());
        mockMvc.perform(get(BASE + "/history/{id}", id)).andExpect(status().isNotFound());
        // Idempotent, comme les autres suppressions de données utilisateur.
        mockMvc.perform(delete(BASE + "/history/{id}", id)).andExpect(status().isNoContent());
    }

    @Test
    void deleting_an_analysis_keeps_the_edition_and_the_prices_it_recorded() throws Exception {
        MangaEdition edition = uneEdition(14);
        String corps = mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content("{\"platform\":\"VINTED\",\"rawTitle\":\"Lot\",\"askingPrice\":60,"
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"items\":[{\"seriesTitle\":\"" + edition.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":"
                                + "[1,2,3,4,5,6,7,8,9,10,11,12,13,14]}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(objectMapper.readTree(corps).get("id").asText());
        assertThat(observationRepository.findByEditionId(edition.id())).isNotEmpty();

        mockMvc.perform(delete(BASE + "/history/{id}", id)).andExpect(status().isNoContent());

        // Ce sont des données de référence, pas des sous-objets de l'analyse :
        // les emporter appauvrirait toutes les analyses suivantes.
        assertThat(observationRepository.findByEditionId(edition.id())).isNotEmpty();
        assertThat(mangaEditionRepository.findById(edition.id())).isPresent();
    }

    @Test
    void returns_404_for_an_absent_analysis_and_400_for_a_malformed_id() throws Exception {
        mockMvc.perform(get(BASE + "/history/{id}", ABSENT)).andExpect(status().isNotFound());
        mockMvc.perform(get(BASE + "/history/{id}", MALFORME))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
        mockMvc.perform(delete(BASE + "/history/{id}", MALFORME)).andExpect(status().isBadRequest());
    }

    // ═══════════════════════════════════════════════════ Éditions

    @Test
    void creates_an_edition_and_finds_it_again_by_series_and_name() throws Exception {
        String serie = "Vagabond " + UUID.randomUUID();

        mockMvc.perform(post(BASE + "/editions").contentType("application/json")
                        .content("{\"seriesTitle\":\"" + serie + "\",\"editionName\":\"VIZBIG\","
                                + "\"editionTier\":\"INTEGRAL\",\"publisher\":\"Kodansha\","
                                + "\"totalVolumes\":12,\"retailPriceNewPerVolume\":25.0,"
                                + "\"outOfPrint\":false,\"betterEditionAnnounced\":false}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.seriesTitle").value(serie))
                .andExpect(jsonPath("$.tier").value("INTEGRAL"))
                .andExpect(jsonPath("$.totalVolumes").value(12));

        mockMvc.perform(get(BASE + "/editions").param("seriesTitle", serie).param("editionName", "VIZBIG"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publisher").value("Kodansha"));
        mockMvc.perform(get(BASE + "/editions/search").param("seriesTitle", serie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(get(BASE + "/editions/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.seriesTitle=='" + serie + "')]").exists());
    }

    @Test
    void rejects_an_edition_pointing_at_a_series_that_does_not_exist_rather_than_a_confusing_conflict()
            throws Exception {
        long avant = mangaEditionRepository.findAll().size();

        // Découvert par cette passe : seule la clé étrangère protégeait
        // manga_edition.entity_id, et le client recevait « Cette donnée entre en
        // conflit avec une donnée existante » - alors que la Série est ABSENTE.
        //
        // 400 et non 404 : la ressource visée (POST /editions) existe, c'est la
        // référence fournie dans le CORPS qui est invalide - même convention que
        // /experiences, /wishlist et /relationships. Le
        // message compte autant que le status : le client remplace celui de tout
        // 404 par un repli générique, si bien qu'en 404 « Série introuvable »
        // n'atteindrait jamais l'écran.
        mockMvc.perform(post(BASE + "/editions").contentType("application/json")
                        .content("{\"entityId\":\"" + ABSENT + "\",\"seriesTitle\":\"Une série\","
                                + "\"editionName\":\"Standard\",\"editionTier\":\"STANDARD\","
                                + "\"outOfPrint\":false,\"betterEditionAnnounced\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("introuvable")));

        // Et rien n'a été écrit au passage.
        assertThat(mangaEditionRepository.findAll()).hasSize((int) avant);
    }

    @Test
    void links_a_new_edition_to_an_existing_series_when_its_id_is_given() throws Exception {
        Entity serie = catalogEntityResolver.resolveOrCreate(EntityTypeFixtures.MANGA.id(),
                "Monster " + UUID.randomUUID(), Map.of()).entity();

        mockMvc.perform(post(BASE + "/editions").contentType("application/json")
                        .content("{\"entityId\":\"" + serie.id() + "\",\"seriesTitle\":\"" + serie.title() + "\","
                                + "\"editionName\":\"Standard\",\"editionTier\":\"STANDARD\","
                                + "\"outOfPrint\":false,\"betterEditionAnnounced\":false}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entityId").value(serie.id().toString()));
    }

    @Test
    void refuses_a_duplicate_edition_with_409_rather_than_a_raw_sql_error() throws Exception {
        String serie = "Naruto " + UUID.randomUUID();
        String corps = "{\"seriesTitle\":\"" + serie + "\",\"editionName\":\"Standard\","
                + "\"editionTier\":\"STANDARD\",\"outOfPrint\":false,\"betterEditionAnnounced\":false}";
        mockMvc.perform(post(BASE + "/editions").contentType("application/json").content(corps))
                .andExpect(status().isCreated());

        // Un double clic sur « Enregistrer » : conflit réel, donc 409 légitime.
        mockMvc.perform(post(BASE + "/editions").contentType("application/json").content(corps))
                .andExpect(status().isConflict());
    }

    @Test
    void rejects_an_edition_without_a_series_title_with_400_instead_of_crashing() throws Exception {
        // La seconde porte du même défaut que l'analyse sans série : le trim()
        // de SeriesMatcher s'exécutait avant toute garde.
        mockMvc.perform(post(BASE + "/editions").contentType("application/json")
                        .content("{\"editionName\":\"Standard\",\"editionTier\":\"STANDARD\","
                                + "\"outOfPrint\":false,\"betterEditionAnnounced\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    @Test
    void updates_an_edition_partially_leaving_untouched_what_the_body_omits() throws Exception {
        MangaEdition edition = uneEdition(14);

        mockMvc.perform(patch(BASE + "/editions/{id}", edition.id()).contentType("application/json")
                        .content("{\"publisher\":\"Glénat corrigé\",\"outOfPrint\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publisher").value("Glénat corrigé"))
                .andExpect(jsonPath("$.outOfPrint").value(true))
                // Champs absents du corps = inchangés.
                .andExpect(jsonPath("$.totalVolumes").value(14))
                .andExpect(jsonPath("$.tier").value("STANDARD"));
    }

    @Test
    void returns_404_when_updating_an_edition_that_does_not_exist() throws Exception {
        mockMvc.perform(patch(BASE + "/editions/{id}", ABSENT).contentType("application/json")
                        .content("{\"publisher\":\"x\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deletes_an_unused_edition_and_refuses_one_that_prices_reference() throws Exception {
        MangaEdition libre = uneEdition(5);
        mockMvc.perform(delete(BASE + "/editions/{id}", libre.id())).andExpect(status().isNoContent());
        assertThat(mangaEditionRepository.findById(libre.id())).isEmpty();

        MangaEdition referencee = uneEdition(5);
        observationRepository.save(MarketPriceObservation.record_(referencee.id(), new VolumeRange(1, 5),
                new BigDecimal("30"), ListingPlatform.VINTED, Condition.VERY_GOOD, LocalDate.now(), null));

        // Un relevé documente cette édition : l'effacer emporterait la donnée
        // de référence sans le dire.
        mockMvc.perform(delete(BASE + "/editions/{id}", referencee.id()))
                .andExpect(status().isConflict());
        assertThat(mangaEditionRepository.findById(referencee.id())).isPresent();
    }

    // ════════════════════════════════════ Relevés de prix (manuels)

    @Test
    void records_a_manual_price_observation_and_lists_it() throws Exception {
        MangaEdition edition = uneEdition(14);

        mockMvc.perform(post(BASE + "/market-observations").contentType("application/json")
                        .content("{\"mangaEditionId\":\"" + edition.id() + "\",\"volumeRangeStart\":1,"
                                + "\"volumeRangeEnd\":14,\"observedPrice\":56.0,\"platform\":\"LEBONCOIN\","
                                + "\"observedCondition\":\"GOOD\",\"observedAt\":\"2026-08-01\","
                                + "\"note\":\"vu en boutique\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.observedPrice").value(56.0))
                .andExpect(jsonPath("$.platform").value("LEBONCOIN"))
                .andExpect(jsonPath("$.origin").value("MANUAL_ENTRY"))
                .andExpect(jsonPath("$.scope.from").value(1));

        String corps = mockMvc.perform(get(BASE + "/market-observations")
                        .param("mangaEditionId", edition.id().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andReturn().getResponse().getContentAsString();

        UUID id = UUID.fromString(objectMapper.readTree(corps).get(0).get("id").asText());
        mockMvc.perform(delete(BASE + "/market-observations/{id}", id)).andExpect(status().isNoContent());
        assertThat(observationRepository.findByEditionId(edition.id())).isEmpty();
        // La suppression d'un relevé ne touche pas l'édition qu'il documentait.
        assertThat(mangaEditionRepository.findById(edition.id())).isPresent();
    }

    @Test
    void rejects_a_price_observation_that_cannot_stand_on_its_own_with_400_and_never_500() throws Exception {
        MangaEdition edition = uneEdition(14);
        String base = "{\"mangaEditionId\":\"%s\",\"observedPrice\":%s,\"platform\":\"%s\",\"observedAt\":%s}";

        for (String corps : new String[] {
                "{}", "", "{pas du json",
                base.formatted(edition.id(), "40", "VINTED", "null"),          // sans date
                base.formatted(edition.id(), "null", "VINTED", "\"2026-08-01\""), // sans prix
                base.formatted(edition.id(), "-5", "VINTED", "\"2026-08-01\""),   // prix négatif
                base.formatted(ABSENT, "40", "VINTED", "\"2026-08-01\""),         // édition absente
                base.formatted(edition.id(), "40", "MAGIC", "\"2026-08-01\"")}) { // plateforme inconnue
            mockMvc.perform(post(BASE + "/market-observations").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
        assertThat(observationRepository.findByEditionId(edition.id())).isEmpty();
    }

    @Test
    void rejects_an_inverted_volume_range_with_400() throws Exception {
        MangaEdition edition = uneEdition(14);

        mockMvc.perform(post(BASE + "/market-observations").contentType("application/json")
                        .content("{\"mangaEditionId\":\"" + edition.id() + "\",\"volumeRangeStart\":9,"
                                + "\"volumeRangeEnd\":2,\"observedPrice\":40,\"platform\":\"VINTED\","
                                + "\"observedAt\":\"2026-08-01\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    // ══════════════════════════════════════════ Lectures calculées

    @Test
    void computes_completeness_for_a_known_edition_and_stays_silent_for_an_unknown_one() throws Exception {
        MangaEdition edition = uneEdition(27);

        mockMvc.perform(get(BASE + "/completeness")
                        .param("seriesTitle", edition.seriesTitle())
                        .param("editionName", "Standard")
                        // Le paramètre s'appelle « volumes » : un nom qui ne
                        // correspond pas est simplement ignoré, et la complétude
                        // porterait alors sur zéro tome possédé.
                        .param("volumes", "1,2,3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVolumes").value(27))
                .andExpect(jsonPath("$.missingCount").value(24));

        // Une édition inconnue ne se devine pas : la complétude se tait plutôt
        // que d'inventer un total.
        mockMvc.perform(get(BASE + "/completeness")
                        .param("seriesTitle", "Jamais vue " + UUID.randomUUID())
                        .param("editionName", "Standard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVolumes").doesNotExist());
    }

    @Test
    void the_read_endpoints_reject_a_missing_required_parameter_with_400() throws Exception {
        // Quatre routes exigent un paramètre : l'oubli est une requête invalide,
        // pas une erreur serveur.
        mockMvc.perform(get(BASE + "/completeness")).andExpect(status().isBadRequest());
        mockMvc.perform(get(BASE + "/editions")).andExpect(status().isBadRequest());
        mockMvc.perform(get(BASE + "/editions/search")).andExpect(status().isBadRequest());
        mockMvc.perform(get(BASE + "/market-observations")).andExpect(status().isBadRequest());
        mockMvc.perform(get(BASE + "/editions/ai-suggestion")).andExpect(status().isBadRequest());
    }

    @Test
    void returns_404_when_looking_up_an_edition_that_was_never_recorded() throws Exception {
        mockMvc.perform(get(BASE + "/editions")
                        .param("seriesTitle", "Inconnue " + UUID.randomUUID())
                        .param("editionName", "Standard"))
                .andExpect(status().isNotFound());
    }

    @Test
    void the_near_complete_suggestions_endpoint_answers_on_an_empty_collection() throws Exception {
        // Écran « Découvrir » : il doit s'ouvrir avant qu'une seule série soit
        // presque complète.
        mockMvc.perform(get(BASE + "/near-complete-suggestions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void the_ai_edition_suggestion_answers_without_any_provider_configured() throws Exception {
        // Aucun fournisseur IA n'est câblé en test : la route doit répondre
        // proprement plutôt que d'échouer, et surtout ne faire aucun appel
        // réseau.
        mockMvc.perform(get(BASE + "/editions/ai-suggestion")
                        .param("seriesTitle", "Berserk").param("editionName", "Standard"))
                .andExpect(status().is2xxSuccessful());
    }

    // ═══════════════════════════════════════════════════ Préférences

    @Test
    void reads_then_updates_collector_preferences() throws Exception {
        mockMvc.perform(get(BASE + "/preferences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editionTierRanking").isArray())
                .andExpect(jsonPath("$.conditionImportance").isNotEmpty());

        mockMvc.perform(patch(BASE + "/preferences").contentType("application/json")
                        .content("{\"preferCompletedSeries\":false,\"minimumDiscountVsRetailPercent\":15,"
                                + "\"conditionImportance\":\"MEDIUM\","
                                + "\"editionTierRanking\":[\"PERFECT\",\"STANDARD\"],\"factorWeights\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferCompletedSeries").value(false))
                .andExpect(jsonPath("$.minimumDiscountVsRetailPercent").value(15))
                .andExpect(jsonPath("$.editionTierRanking[0]").value("PERFECT"));
    }

    @Test
    void rejects_incomplete_or_invalid_preferences_with_400_and_never_500() throws Exception {
        // Le 500 historique : editionTierRanking absent atteignait un .stream()
        // sur null. Le champ est désormais exigé nommément.
        for (String corps : new String[] {
                "{}", "", "{pas du json",
                "{\"editionTierRanking\":[\"MAGIC\"],\"factorWeights\":{}}",
                "{\"editionTierRanking\":[\"STANDARD\"],\"factorWeights\":{\"PAS_UN_FACTEUR\":3}}",
                // Les trois champs sont exigés : cet endpoint REMPLACE le
                // profil entier, il ne fusionne pas.
                "{\"editionTierRanking\":[\"STANDARD\"]}",
                "{\"editionTierRanking\":[\"STANDARD\"],\"factorWeights\":{}}"}) {
            mockMvc.perform(patch(BASE + "/preferences").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }
}
