package com.iozycore.integration.http;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.iozycore.integration.http.FakeMetadataProviders.CLE_IDENTIFIANT_DE_TEST;
import static com.iozycore.integration.http.FakeMetadataProviders.COUVERTURE_DES_DETAILS;
import static com.iozycore.integration.http.FakeMetadataProviders.DECLENCHE_PANNE;
import static com.iozycore.integration.http.FakeMetadataProviders.DECLENCHE_PARTIEL;
import static com.iozycore.integration.http.FakeMetadataProviders.DECLENCHE_VIDE;
import static com.iozycore.integration.http.FakeMetadataProviders.HOTE_DE_TEST;
import static com.iozycore.integration.http.FakeMetadataProviders.UNIVERS_DE_TEST;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The HTTP contract of the two surfaces that talk to the outside world:
 * {@code /api/metadata} (five routes) and {@code /api/listing-metadata} (one).
 *
 * <h2>No network call, and not by accident</h2>
 * These tests import {@link FakeMetadataProviders}, whose fakes only
 * answer to a universe and a host invented for the occasion. The real
 * providers - Jikan, Google Books, BGG, IGDB, Vinted - decline by themselves
 * through their own {@code supports(...)}, without having to deactivate them. A
 * test that would query a real source would therefore fail to find its fake,
 * rather than silently going out on the network.
 *
 * <h2>What is protected</h2>
 * Only the boundary: routing, parameters, DTOs, and above all the
 * <b>translation of situations</b> into status codes. Five distinct situations live
 * here and are easily mixed up - unknown universe, missing parameter, no
 * compatible provider, compatible provider but no result, and
 * provider down. Merging them into a generic 500 or 409 is the defect
 * that these tests forbid.
 */
@Import(FakeMetadataProviders.class)
class MetadataHttpContractTest extends HttpContractTestBase {

    @Autowired
    private EntityTypeRepository entityTypeRepository;

    private static final String META = "/api/metadata";
    private static final String LISTING = "/api/listing-metadata";

    /** The universe to which only the fakes answer. */
    private UUID universDeTest() {
        return entityTypeRepository.findByCode(UNIVERS_DE_TEST)
                .map(EntityType::id)
                .orElseGet(() -> entityTypeRepository.save(EntityType.create(
                        UNIVERS_DE_TEST, "Univers de test", Set.of("READ"), Set.of())).id());
    }

    /**
     * A second test universe that <b>nobody</b> covers - neither the fakes nor
     * the real ones.
     *
     * <h2>Why not simply "Manga"</h2>
     * It was my first version, and it was wrong in a way that matters:
     * Manga IS covered by real providers (Google Books, OpenLibrary,
     * Jikan), so the test really went out on the network to prove
     * that no provider answered. An invented universe has no
     * real implementation: the branch "nobody can answer" is
     * reached without a single connection being opened.
     */
    private UUID universSansAucunFournisseur() {
        return entityTypeRepository.findByCode("ZZAUCUN")
                .map(EntityType::id)
                .orElseGet(() -> entityTypeRepository.save(EntityType.create(
                        "ZZAUCUN", "Univers sans fournisseur", Set.of("READ"), Set.of())).id());
    }

    private String url(String suffixe) {
        return "https://" + HOTE_DE_TEST + "/annonce/" + suffixe;
    }

    // ══════════════════════════════════════════════ GET /metadata/search

    @Test
    void searches_metadata_through_the_provider_that_supports_the_universe() throws Exception {
        mockMvc.perform(get(META + "/search")
                        .param("entityTypeId", universDeTest().toString())
                        .param("query", "Berserk"))
                .andExpect(status().isOk())
                // The value comes from the fake: the request did go through the
                // service up to the provider, and the DTO came back whole.
                .andExpect(jsonPath("$[0].source").value("SOURCE_DE_TEST"))
                .andExpect(jsonPath("$[0].title").value("Résultat de test : Berserk"))
                .andExpect(jsonPath("$[0].attributes.mangaka").value("Autrice de test"));
    }

    @Test
    void a_provider_does_not_answer_for_a_universe_it_does_not_support() throws Exception {
        // The fake only answers to its universe. Querying ANOTHER universe must not
        // make it take the request - this is what guarantees that in
        // production the right provider is chosen. The universe aimed at here has no
        // implementation, real or fake: the empty response therefore proves that
        // nobody answered, and not that a remote source found nothing.
        mockMvc.perform(get(META + "/search")
                        .param("entityTypeId", universSansAucunFournisseur().toString())
                        .param("query", "aucun-fournisseur-de-test-ne-repond"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void a_search_that_finds_nothing_is_an_empty_list_not_an_error() throws Exception {
        // "No result" is not "something failed": the search screen
        // shows "nothing found", it does not handle a 404.
        mockMvc.perform(get(META + "/search")
                        .param("entityTypeId", universDeTest().toString())
                        .param("query", DECLENCHE_VIDE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void rejects_an_unknown_universe_or_a_missing_query_with_400() throws Exception {
        mockMvc.perform(get(META + "/search")
                        .param("entityTypeId", ABSENT).param("query", "x"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(META + "/search")
                        .param("entityTypeId", universDeTest().toString()).param("query", "   "))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(META + "/search").param("query", "x"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(META + "/search")
                        .param("entityTypeId", MALFORME).param("query", "x"))
                .andExpect(status().isBadRequest());
    }

    // ═══════════════════════════════════════════ GET /metadata/details

    @Test
    void gives_the_details_of_one_work_named_by_its_source_id() throws Exception {
        mockMvc.perform(get(META + "/details")
                        .param("entityTypeId", universDeTest().toString())
                        .param(CLE_IDENTIFIANT_DE_TEST, "fake-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coverImageUrl").value(COUVERTURE_DES_DETAILS))
                .andExpect(jsonPath("$.minPlayers").value(2))
                .andExpect(jsonPath("$.entityTypeId").doesNotExist());
    }

    @Test
    void a_silent_source_gives_no_details_rather_than_an_error() throws Exception {
        mockMvc.perform(get(META + "/details")
                        .param("entityTypeId", universDeTest().toString())
                        .param(CLE_IDENTIFIANT_DE_TEST, DECLENCHE_PANNE))
                .andExpect(status().isOk())
                .andExpect(content().json("{}"));
        mockMvc.perform(get(META + "/details").param("entityTypeId", UUID.randomUUID().toString()))
                .andExpect(status().isBadRequest());
    }

    // ═══════════════════════════ Details asked once, when a work is added

    private String ajoutRapide(String titre, Map<String, Object> attributs) throws Exception {
        Map<String, Object> corps = new HashMap<>();
        corps.put("entityTypeId", universDeTest().toString());
        corps.put("title", titre + " " + UUID.randomUUID());
        corps.put("condition", "USED");
        corps.put("attributes", attributs);
        String reponse = mockMvc.perform(post("/api/entities/quick-add")
                        .contentType("application/json").content(json(corps)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(reponse, "$.entityId");
    }

    @Test
    void an_added_work_gets_the_details_its_search_result_did_not_have() throws Exception {
        String id = ajoutRapide("Carcassonne", Map.of(CLE_IDENTIFIANT_DE_TEST, "fake-1"));

        mockMvc.perform(get("/api/entities/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attributes.coverImageUrl").value(COUVERTURE_DES_DETAILS))
                .andExpect(jsonPath("$.attributes.minPlayers").value(2));
    }

    @Test
    void what_the_add_already_carries_wins_over_the_details() throws Exception {
        String id = ajoutRapide("Azul", Map.of(CLE_IDENTIFIANT_DE_TEST, "fake-1",
                "coverImageUrl", "https://" + HOTE_DE_TEST + "/choisie.jpg"));

        mockMvc.perform(get("/api/entities/" + id))
                .andExpect(jsonPath("$.attributes.coverImageUrl").value("https://" + HOTE_DE_TEST + "/choisie.jpg"))
                .andExpect(jsonPath("$.attributes.minPlayers").value(2));
    }

    @Test
    void a_silent_source_never_fails_the_add() throws Exception {
        String id = ajoutRapide("Dune", Map.of(CLE_IDENTIFIANT_DE_TEST, DECLENCHE_PANNE));

        mockMvc.perform(get("/api/entities/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attributes." + CLE_IDENTIFIANT_DE_TEST).value(DECLENCHE_PANNE))
                .andExpect(jsonPath("$.attributes.coverImageUrl").doesNotExist());
    }

    @Test
    void a_work_wanted_before_being_owned_gets_its_details_too() throws Exception {
        Map<String, Object> corps = new HashMap<>();
        corps.put("entityTypeId", universDeTest().toString());
        corps.put("title", "Cascadia " + UUID.randomUUID());
        corps.put("attributes", Map.of(CLE_IDENTIFIANT_DE_TEST, "fake-1"));
        String reponse = mockMvc.perform(post("/api/wishlist").contentType("application/json").content(json(corps)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(reponse, "$.entityId");

        mockMvc.perform(get("/api/entities/" + id))
                .andExpect(jsonPath("$.attributes.coverImageUrl").value(COUVERTURE_DES_DETAILS));
    }

    // ═══════════════════════════════════════ GET /metadata/lookup-barcode

    @Test
    void looks_a_barcode_up_and_distinguishes_not_found_from_a_bad_request() throws Exception {
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", universDeTest().toString())
                        .param("barcode", "9782505011118"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Trouvé par code-barres"))
                .andExpect(jsonPath("$.externalId").value("fake-9782505011118"));

        // Compatible provider but no match: 404, a specific resource
        // was asked for and does not exist. To be distinguished from the search
        // above, which returns an empty list.
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", universDeTest().toString())
                        .param("barcode", DECLENCHE_VIDE))
                .andExpect(status().isNotFound());

        // A source that did not answer is NOT an absence: 503, because the
        // useful action is to try again, where a 404 invites to search by title.
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", universDeTest().toString())
                        .param("barcode", DECLENCHE_PANNE))
                .andExpect(status().isServiceUnavailable());

        // Unknown universe: the request itself is invalid.
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", ABSENT).param("barcode", "123"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void no_compatible_provider_for_a_barcode_is_404_not_a_server_error() throws Exception {
        // No barcode provider covers this universe: nothing to
        // query, so nothing found - and above all not a 500.
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", universSansAucunFournisseur().toString())
                        .param("barcode", "0000000000000"))
                .andExpect(status().isNotFound());
    }

    // ═══════════════════════════════════════ GET /metadata/french-title

    @Test
    void resolves_a_french_title_and_answers_404_when_none_is_known() throws Exception {
        mockMvc.perform(get(META + "/french-title")
                        .param("entityTypeId", universDeTest().toString())
                        .param("query", "Kingdom"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frenchTitle").value("Titre français de test"));

        mockMvc.perform(get(META + "/french-title")
                        .param("entityTypeId", universDeTest().toString())
                        .param("query", DECLENCHE_VIDE))
                .andExpect(status().isNotFound());
    }

    @Test
    void rejects_a_french_title_request_without_a_query_with_400() throws Exception {
        mockMvc.perform(get(META + "/french-title")
                        .param("entityTypeId", universDeTest().toString()).param("query", "  "))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(META + "/french-title")
                        .param("entityTypeId", universDeTest().toString()))
                .andExpect(status().isBadRequest());
    }

    // ═══════════════════════════════════════════ GET /metadata/volumes

    @Test
    void lists_volume_candidates_and_reports_whether_each_is_already_owned() throws Exception {
        mockMvc.perform(get(META + "/volumes")
                        .param("entityTypeId", universDeTest().toString())
                        .param("title", "Vinland Saga"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.volumes.length()").value(2))
                .andExpect(jsonPath("$.volumes[0].volumeNumber").value(1))
                .andExpect(jsonPath("$.volumes[0].edition").value("Standard"))
                // Nothing is owned here: the flag exists and is false,
                // rather than being absent.
                .andExpect(jsonPath("$.volumes[0].alreadyOwned").value(false))
                .andExpect(jsonPath("$.quotaExceeded").exists());
    }

    @Test
    void an_empty_volume_search_is_an_empty_list_not_an_error() throws Exception {
        mockMvc.perform(get(META + "/volumes")
                        .param("entityTypeId", universDeTest().toString())
                        .param("title", DECLENCHE_VIDE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.volumes.length()").value(0));
    }

    @Test
    void rejects_a_volume_search_without_a_title_or_with_an_unknown_universe() throws Exception {
        mockMvc.perform(get(META + "/volumes")
                        .param("entityTypeId", universDeTest().toString()).param("title", " "))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get(META + "/volumes")
                        .param("entityTypeId", ABSENT).param("title", "x"))
                .andExpect(status().isBadRequest());
    }

    // ═══════════════════════════════════════ POST /metadata/bgg/import

    @Test
    void rejects_a_bgg_import_without_a_username_with_400() throws Exception {
        // The only case of this route reachable without network - and this is
        // deliberate: triggering a real import would contact BoardGameGeek.
        mockMvc.perform(post(META + "/bgg/import").param("username", "   "))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(META + "/bgg/import"))
                .andExpect(status().isBadRequest());
    }

    // ═══════════════════════════ POST /listing-metadata/resolve

    @Test
    void reads_a_listing_from_a_supported_source_and_maps_every_field() throws Exception {
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json")
                        .content(json(java.util.Map.of("url", url("complet")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.title").value("Lot complet de test"))
                .andExpect(jsonPath("$.price").value(45))
                .andExpect(jsonPath("$.shippingFee").value(3.78))
                .andExpect(jsonPath("$.shippingKind").value("FROM"))
                .andExpect(jsonPath("$.buyerProtectionFee").value(2.95))
                .andExpect(jsonPath("$.imageUrls.length()").value(1))
                .andExpect(jsonPath("$.externalId").value("42"))
                // retrievedFields says what was REALLY read: it is what
                // allows the form to pre-fill, field by field.
                .andExpect(jsonPath("$.retrievedFields").isNotEmpty());
    }

    @Test
    void a_partial_read_is_a_usable_result_not_a_failure() throws Exception {
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json")
                        .content(json(java.util.Map.of("url", url(DECLENCHE_PARTIEL)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PARTIAL"))
                .andExpect(jsonPath("$.title").value("Lot partiel de test"))
                .andExpect(jsonPath("$.price").value(30))
                // The rest is missing, and this is said without the response failing:
                // a missing piece of data is never guessed.
                .andExpect(jsonPath("$.shippingFee").doesNotExist())
                .andExpect(jsonPath("$.buyerProtectionFee").doesNotExist());
    }

    @Test
    void reports_a_listing_that_no_longer_exists_and_a_source_that_is_down() throws Exception {
        // Two distinct failures, two distinct statuses - mixing them up would deprive
        // the screen of the only useful information: should we try again?
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json")
                        .content(json(java.util.Map.of("url", url(DECLENCHE_VIDE)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LISTING_NOT_FOUND"))
                .andExpect(jsonPath("$.title").doesNotExist());

        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json")
                        .content(json(java.util.Map.of("url", url(DECLENCHE_PANNE)))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"));
    }

    @Test
    void an_unsupported_source_is_reported_without_fetching_anything() throws Exception {
        // A well formed URL to a host that nobody covers: the response
        // says so, and above all the controller does not look for anything at random.
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json")
                        .content(json(java.util.Map.of("url", "https://une-autre-plateforme.test/annonce/42"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNSUPPORTED_SOURCE"))
                // The URL is kept: it is used to find the listing again from
                // the analysis, even without automatic reading.
                .andExpect(jsonPath("$.url").value("https://une-autre-plateforme.test/annonce/42"))
                .andExpect(jsonPath("$.title").doesNotExist());
    }

    @Test
    void an_unusable_url_is_refused_as_invalid_rather_than_followed() throws Exception {
        // All these shapes must be ruled out BEFORE a provider is
        // consulted. The detail of the rules belongs to ListingUrlGuard, which has its
        // own tests; here we only freeze their HTTP translation.
        for (String url : new String[] {"pas une url", "file:///etc/passwd",
                                         "http://" + HOTE_DE_TEST + "/annonce/1", ""}) {
            mockMvc.perform(post(LISTING + "/resolve").contentType("application/json")
                            .content(json(java.util.Map.of("url", url))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("INVALID_URL"));
        }
    }

    @Test
    void rejects_an_absent_or_unparseable_resolve_body_with_400_and_never_500() throws Exception {
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json").content(""))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json").content("{pas du json"))
                .andExpect(status().isBadRequest());
        // Body present but without URL: handled as an unusable URL,
        // never as a server error.
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json").content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INVALID_URL"));
    }
}
