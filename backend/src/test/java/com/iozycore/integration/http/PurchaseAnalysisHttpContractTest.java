package com.iozycore.integration.http;

import com.iozycore.core.application.CatalogEntityResolver;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.MangaEditionRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.manga.deals.Condition;
import com.iozycore.core.listing.ListingPlatform;
import com.iozycore.manga.deals.MarketPriceObservation;
import com.iozycore.manga.deals.MarketPriceObservationRepository;
import com.iozycore.manga.deals.PurchaseAnalysisRepository;
import com.iozycore.manga.deals.VolumeRange;
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
 * The HTTP contract of {@code /api/purchase-analysis} - eighteen routes, eight
 * mutations.
 *
 * <h2>What these tests do NOT do</h2>
 * They do not replay the engine. The verdicts, the medians, the market comparability,
 * the delivery semantics and the ingestion of observations already have
 * more than a hundred and fifty domain and integration tests. This surface
 * therefore had a <b>strong functional coverage</b> and <b>no formal
 * coverage of its HTTP boundary</b> - two different layers.
 *
 * <h2>What they protect</h2>
 * The passage: routing, deserialisation, binding, translation of exceptions into
 * status codes, and above all <b>the absence of partial effect</b>. A batch with a single
 * invalid item must leave nothing in the database.
 *
 * <h2>Why it was necessary here too</h2>
 * Two production defects were found while writing these tests, both
 * invisible from a domain test: a {@code trim()} on a null title,
 * reachable through two distinct doors, and a foreign key left as the judge
 * of the contract for a missing Series.
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

    /** The simplest analysis body that is valid - one series, a batch of volumes. */
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

    // ══════════════════════════════════════ POST /analyze - the core

    @Test
    void analyses_a_manual_listing_without_any_url_and_persists_it() throws Exception {
        MangaEdition edition = uneEdition(14);

        String corps = mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content(analyseDe(edition.seriesTitle(), "70", 1, 2, 3)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                // The product invariant: the analysis does not depend on Vinted. No
                // URL is provided here, and the computation succeeds anyway.
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

        // The JSON that the form would send after reading a listing. No
        // network call: the values are set directly.
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
                // 45 + 2.95 + 3.78: the acquisition cost, distinct from the price.
                .andExpect(jsonPath("$.totalRealCost").value(51.73));
    }

    @Test
    void normalises_an_unknown_shipping_kind_carrying_an_amount_into_an_estimate() throws Exception {
        MangaEdition edition = uneEdition(14);

        // The normalisation lives in the domain and is tested there; what is at stake
        // here is that an HTTP request does go through it.
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
        // Found by this pass, and it was a real 500: SeriesMatcher
        // called trim() on the title before any guard. Two doors led to
        // the same defect - this one and the creation of an edition.
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

        // Atomicity is the real stake: a half-written batch would leave an
        // analysis whose verdict matches nothing of what was asked.
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
                // The collection is deserialised and mapped in the order received.
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
                // Empty batch, missing price, negative price, non-numeric price.
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

    // ══════════════════════════ Observation ingestion, a strong case

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
        // THE point: the market keeps the price of the listing, never the acquisition
        // cost (45 + 2.95 + 3.78 = 51.73). The fees are those of
        // the buyer, not the value of the product.
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

        // The price covers the whole set: splitting it would make up a price that
        // nobody asked for. The analysis lives, the observation does not.
        assertThat(observationRepository.findByEditionId(premiere.id())).isEmpty();
        assertThat(observationRepository.findByEditionId(seconde.id())).isEmpty();
    }

    // ═══════════════════════════════════════════ History: read, delete

    @Test
    void lists_and_reads_back_a_saved_analysis_then_deletes_it_idempotently() throws Exception {
        MangaEdition edition = uneEdition(14);
        String corps = mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        .content(analyseDe(edition.seriesTitle(), "70", 1, 2)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(objectMapper.readTree(corps).get("id").asText());

        mockMvc.perform(get(BASE + "/history"))
                .andExpect(status().isOk())
                // The list is a light projection: it carries the verdict and
                // the cost, not the full detail.
                .andExpect(jsonPath("$[?(@.id=='" + id + "')].totalRealCost").exists())
                .andExpect(jsonPath("$[?(@.id=='" + id + "')].verdict").exists());

        mockMvc.perform(get(BASE + "/history/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.listing.rawTitle").value("Lot de test"))
                .andExpect(jsonPath("$.itemBreakdown[0].item.series.title").value(edition.seriesTitle()));

        mockMvc.perform(delete(BASE + "/history/{id}", id)).andExpect(status().isNoContent());
        mockMvc.perform(get(BASE + "/history/{id}", id)).andExpect(status().isNotFound());
        // Idempotent, like the other deletions of user data.
        mockMvc.perform(delete(BASE + "/history/{id}", id)).andExpect(status().isNoContent());
    }

    @Test
    void deleting_an_analysis_keeps_the_edition_and_the_prices_it_recorded() throws Exception {
        MangaEdition edition = uneEdition(14);
        String corps = mockMvc.perform(post(BASE + "/analyze").contentType("application/json")
                        // The listing carries an identity: this is what allows the automatic
                        // observation of the asked price, so what this test needs to have in
                        // place before checking that the deletion does not take it away. Without
                        // identity, nothing is observed anymore - a listing without provenance can
                        // be neither deduplicated nor excluded from its own reference.
                        .content("{\"platform\":\"VINTED\",\"rawTitle\":\"Lot\",\"askingPrice\":60,"
                                + "\"url\":\"https://www.vinted.fr/items/4242-lot\",\"externalListingId\":\"4242\","
                                + "\"condition\":\"VERY_GOOD\",\"conditionAppliesToContainer\":false,"
                                + "\"items\":[{\"seriesTitle\":\"" + edition.seriesTitle() + "\","
                                + "\"editionName\":\"Standard\",\"includedVolumes\":"
                                + "[1,2,3,4,5,6,7,8,9,10,11,12,13,14]}]}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(objectMapper.readTree(corps).get("id").asText());
        assertThat(observationRepository.findByEditionId(edition.id())).isNotEmpty();

        mockMvc.perform(delete(BASE + "/history/{id}", id)).andExpect(status().isNoContent());

        // These are reference data, not sub-objects of the analysis:
        // taking them away would make all the following analyses poorer.
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

    // ═══════════════════════════════════════════════════ Editions

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

        // Found by this pass: only the foreign key protected
        // manga_edition.entity_id, and the client received "Cette donnée entre en
        // conflit avec une donnée existante" - while the Series is ABSENT.
        //
        // 400 and not 404: the targeted resource (POST /editions) exists, it is the
        // reference given in the BODY that is invalid - same convention as
        // /experiences, /wishlist and /relationships. The
        // message matters as much as the status: the client replaces the one of any
        // 404 with a generic fallback, so that with a 404 "Série introuvable"
        // would never reach the screen.
        mockMvc.perform(post(BASE + "/editions").contentType("application/json")
                        .content("{\"entityId\":\"" + ABSENT + "\",\"seriesTitle\":\"Une série\","
                                + "\"editionName\":\"Standard\",\"editionTier\":\"STANDARD\","
                                + "\"outOfPrint\":false,\"betterEditionAnnounced\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("introuvable")));

        // And nothing was written on the way.
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

        // A double click on "Enregistrer": real conflict, so a legitimate 409.
        mockMvc.perform(post(BASE + "/editions").contentType("application/json").content(corps))
                .andExpect(status().isConflict());
    }

    @Test
    void rejects_an_edition_without_a_series_title_with_400_instead_of_crashing() throws Exception {
        // The second door of the same defect as the analysis without series: the trim()
        // of SeriesMatcher ran before any guard.
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
                // Fields missing from the body = unchanged.
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

        // An observation documents this edition: erasing it would take away the
        // reference data without saying so.
        mockMvc.perform(delete(BASE + "/editions/{id}", referencee.id()))
                .andExpect(status().isConflict());
        assertThat(mangaEditionRepository.findById(referencee.id())).isPresent();
    }

    // ════════════════════════════════════ Price observations (manual)

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
        // The deletion of an observation does not touch the edition it documented.
        assertThat(mangaEditionRepository.findById(edition.id())).isPresent();
    }

    @Test
    void rejects_a_price_observation_that_cannot_stand_on_its_own_with_400_and_never_500() throws Exception {
        MangaEdition edition = uneEdition(14);
        String base = "{\"mangaEditionId\":\"%s\",\"observedPrice\":%s,\"platform\":\"%s\",\"observedAt\":%s}";

        for (String corps : new String[] {
                "{}", "", "{pas du json",
                base.formatted(edition.id(), "40", "VINTED", "null"),          // without date
                base.formatted(edition.id(), "null", "VINTED", "\"2026-08-01\""), // without price
                base.formatted(edition.id(), "-5", "VINTED", "\"2026-08-01\""),   // negative price
                base.formatted(ABSENT, "40", "VINTED", "\"2026-08-01\""),         // missing edition
                base.formatted(edition.id(), "40", "MAGIC", "\"2026-08-01\"")}) { // unknown platform
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

    // ══════════════════════════════════════════ Computed reads

    @Test
    void computes_completeness_for_a_known_edition_and_stays_silent_for_an_unknown_one() throws Exception {
        MangaEdition edition = uneEdition(27);

        mockMvc.perform(get(BASE + "/completeness")
                        .param("seriesTitle", edition.seriesTitle())
                        .param("editionName", "Standard")
                        // The parameter is called "volumes": a name that does not
                        // match is simply ignored, and the completeness
                        // would then be about zero owned volumes.
                        .param("volumes", "1,2,3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVolumes").value(27))
                .andExpect(jsonPath("$.missingCount").value(24));

        // An unknown edition is not guessed: the completeness stays silent rather
        // than making up a total.
        mockMvc.perform(get(BASE + "/completeness")
                        .param("seriesTitle", "Jamais vue " + UUID.randomUUID())
                        .param("editionName", "Standard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVolumes").doesNotExist());
    }

    @Test
    void the_read_endpoints_reject_a_missing_required_parameter_with_400() throws Exception {
        // Four routes require a parameter: forgetting it is an invalid request,
        // not a server error.
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
        // "Discover" screen: it must open before a single series is
        // almost complete.
        mockMvc.perform(get(BASE + "/near-complete-suggestions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void the_ai_edition_suggestion_answers_without_any_provider_configured() throws Exception {
        // No AI provider is wired in the test: the route must answer
        // properly rather than fail, and above all make no network
        // call.
        mockMvc.perform(get(BASE + "/editions/ai-suggestion")
                        .param("seriesTitle", "Berserk").param("editionName", "Standard"))
                .andExpect(status().is2xxSuccessful());
    }

    // ═══════════════════════════════════════════════════ Preferences

    @Test
    void reads_then_updates_collector_preferences() throws Exception {
        mockMvc.perform(get(BASE + "/preferences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editionTierRanking").isArray())
                .andExpect(jsonPath("$.conditionImportance").isNotEmpty());

        mockMvc.perform(patch(BASE + "/preferences").contentType("application/json")
                        // preferCompletedSeries no longer exists (Batch 84) - left here on purpose:
                        // a body that still carries a removed field must be ACCEPTED, not rejected,
                        // otherwise a client not yet updated would break on a setting that,
                        // anyway, did nothing.
                        .content("{\"preferCompletedSeries\":false,\"minimumDiscountVsRetailPercent\":15,"
                                + "\"conditionImportance\":\"MEDIUM\","
                                + "\"editionTierRanking\":[\"PERFECT\",\"STANDARD\"],\"factorWeights\":{}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferCompletedSeries").doesNotExist())
                .andExpect(jsonPath("$.minimumDiscountVsRetailPercent").value(15))
                .andExpect(jsonPath("$.editionTierRanking[0]").value("PERFECT"));
    }

    @Test
    void rejects_incomplete_or_invalid_preferences_with_400_and_never_500() throws Exception {
        // The historical 500: a missing editionTierRanking reached a .stream()
        // on null. The field is now explicitly required.
        for (String corps : new String[] {
                "{}", "", "{pas du json",
                "{\"editionTierRanking\":[\"MAGIC\"],\"factorWeights\":{}}",
                "{\"editionTierRanking\":[\"STANDARD\"],\"factorWeights\":{\"PAS_UN_FACTEUR\":3}}",
                // The three fields are required: this endpoint REPLACES the
                // whole profile, it does not merge.
                "{\"editionTierRanking\":[\"STANDARD\"]}",
                "{\"editionTierRanking\":[\"STANDARD\"],\"factorWeights\":{}}"}) {
            mockMvc.perform(patch(BASE + "/preferences").contentType("application/json").content(corps))
                    .andExpect(status().isBadRequest());
        }
    }
}
