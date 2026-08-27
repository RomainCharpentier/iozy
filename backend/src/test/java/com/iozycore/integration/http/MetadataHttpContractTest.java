package com.iozycore.integration.http;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

import java.util.Set;
import java.util.UUID;

import static com.iozycore.integration.http.FakeMetadataProviders.DECLENCHE_PANNE;
import static com.iozycore.integration.http.FakeMetadataProviders.DECLENCHE_PARTIEL;
import static com.iozycore.integration.http.FakeMetadataProviders.DECLENCHE_VIDE;
import static com.iozycore.integration.http.FakeMetadataProviders.HOTE_DE_TEST;
import static com.iozycore.integration.http.FakeMetadataProviders.UNIVERS_DE_TEST;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Le contrat HTTP des deux surfaces qui parlent au monde extérieur :
 * {@code /api/metadata} (cinq routes) et {@code /api/listing-metadata} (une).
 *
 * <h2>Aucun appel réseau, et pas par accident</h2>
 * Ces tests importent {@link FakeMetadataProviders}, dont les faux ne
 * répondent qu'à un univers et à un hôte inventés pour l'occasion. Les vrais
 * fournisseurs - Jikan, Google Books, BGG, IGDB, Vinted - déclinent d'eux-mêmes
 * par leur propre {@code supports(...)}, sans qu'on ait à les désactiver. Un
 * test qui interrogerait une vraie source échouerait donc à trouver son faux,
 * plutôt que de partir silencieusement sur le réseau.
 *
 * <h2>Ce qui est protégé</h2>
 * Uniquement la frontière : routage, paramètres, DTO, et surtout la
 * <b>traduction des situations</b> en status. Cinq situations distinctes vivent
 * ici et se confondent facilement - univers inconnu, paramètre manquant, aucun
 * fournisseur compatible, fournisseur compatible mais sans résultat, et
 * fournisseur en panne. Les fondre en un 500 ou un 409 générique est le défaut
 * que ces tests interdisent.
 */
@Import(FakeMetadataProviders.class)
class MetadataHttpContractTest extends HttpContractTestBase {

    @Autowired
    private EntityTypeRepository entityTypeRepository;

    private static final String META = "/api/metadata";
    private static final String LISTING = "/api/listing-metadata";

    /** L'univers auquel seuls les faux répondent. */
    private UUID universDeTest() {
        return entityTypeRepository.findByCode(UNIVERS_DE_TEST)
                .map(EntityType::id)
                .orElseGet(() -> entityTypeRepository.save(EntityType.create(
                        UNIVERS_DE_TEST, "Univers de test", Set.of("READ"), Set.of())).id());
    }

    /**
     * Un second univers de test que <b>personne</b> ne couvre - ni les faux, ni
     * les vrais.
     *
     * <h2>Pourquoi pas simplement « Manga »</h2>
     * C'était ma première version, et elle était fausse d'une façon qui compte :
     * Manga EST couvert par de vrais fournisseurs (Google Books, OpenLibrary,
     * Jikan), si bien que le test partait réellement sur le réseau pour prouver
     * qu'aucun fournisseur ne répondait. Un univers inventé n'a, lui, aucune
     * implémentation réelle : la branche « personne ne sait répondre » est
     * atteinte sans qu'une seule connexion soit ouverte.
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
                // La valeur vient du faux : la requête a bien traversé le
                // service jusqu'au fournisseur, et le DTO est remonté entier.
                .andExpect(jsonPath("$[0].source").value("SOURCE_DE_TEST"))
                .andExpect(jsonPath("$[0].title").value("Résultat de test : Berserk"))
                .andExpect(jsonPath("$[0].attributes.mangaka").value("Autrice de test"));
    }

    @Test
    void a_provider_does_not_answer_for_a_universe_it_does_not_support() throws Exception {
        // Le faux ne répond qu'à son univers. Interroger un AUTRE univers ne doit
        // pas lui faire prendre la demande - c'est ce qui garantit qu'en
        // production le bon fournisseur est choisi. L'univers visé ici n'a aucune
        // implémentation, réelle ou fausse : la réponse vide prouve donc que
        // personne n'a répondu, et non qu'une source distante n'a rien trouvé.
        mockMvc.perform(get(META + "/search")
                        .param("entityTypeId", universSansAucunFournisseur().toString())
                        .param("query", "aucun-fournisseur-de-test-ne-repond"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void a_search_that_finds_nothing_is_an_empty_list_not_an_error() throws Exception {
        // « Aucun résultat » n'est pas « quelque chose a échoué » : l'écran de
        // recherche affiche « rien trouvé », il ne gère pas un 404.
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

    // ═══════════════════════════════════════ GET /metadata/lookup-barcode

    @Test
    void looks_a_barcode_up_and_distinguishes_not_found_from_a_bad_request() throws Exception {
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", universDeTest().toString())
                        .param("barcode", "9782505011118"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Trouvé par code-barres"))
                .andExpect(jsonPath("$.externalId").value("fake-9782505011118"));

        // Fournisseur compatible mais sans correspondance : 404, une ressource
        // précise a été demandée et n'existe pas. À distinguer de la recherche
        // ci-dessus, qui rend une liste vide.
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", universDeTest().toString())
                        .param("barcode", DECLENCHE_VIDE))
                .andExpect(status().isNotFound());

        // Une source qui n'a pas répondu n'est PAS une absence : 503, parce que le
        // geste utile est de réessayer, là où un 404 invite à chercher par titre.
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", universDeTest().toString())
                        .param("barcode", DECLENCHE_PANNE))
                .andExpect(status().isServiceUnavailable());

        // Univers inconnu : la requête elle-même est invalide.
        mockMvc.perform(get(META + "/lookup-barcode")
                        .param("entityTypeId", ABSENT).param("barcode", "123"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void no_compatible_provider_for_a_barcode_is_404_not_a_server_error() throws Exception {
        // Aucun fournisseur de code-barres ne couvre cet univers : rien à
        // interroger, donc rien trouvé - et surtout pas un 500.
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
                // Rien n'est possédé ici : le drapeau existe et vaut false,
                // plutôt que d'être absent.
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
        // Le seul cas de cette route atteignable sans réseau - et c'est
        // délibéré : déclencher un vrai import contacterait BoardGameGeek.
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
                // retrievedFields dit ce qui a RÉELLEMENT été lu : c'est lui
                // qui autorise le formulaire à pré-remplir, champ par champ.
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
                // Le reste manque, et c'est dit sans que la réponse échoue :
                // une donnée absente n'est jamais devinée.
                .andExpect(jsonPath("$.shippingFee").doesNotExist())
                .andExpect(jsonPath("$.buyerProtectionFee").doesNotExist());
    }

    @Test
    void reports_a_listing_that_no_longer_exists_and_a_source_that_is_down() throws Exception {
        // Deux échecs distincts, deux statuts distincts - les confondre priverait
        // l'écran de la seule information utile : faut-il réessayer ?
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
        // Une URL bien formée vers un hôte que personne ne couvre : la réponse
        // le dit, et surtout le contrôleur ne va rien chercher au hasard.
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json")
                        .content(json(java.util.Map.of("url", "https://une-autre-plateforme.test/annonce/42"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNSUPPORTED_SOURCE"))
                // L'URL est conservée : elle sert à retrouver l'annonce depuis
                // l'analyse, même sans lecture automatique.
                .andExpect(jsonPath("$.url").value("https://une-autre-plateforme.test/annonce/42"))
                .andExpect(jsonPath("$.title").doesNotExist());
    }

    @Test
    void an_unusable_url_is_refused_as_invalid_rather_than_followed() throws Exception {
        // Toutes ces formes doivent être écartées AVANT qu'un fournisseur soit
        // consulté. Le détail des règles appartient à ListingUrlGuard, qui a ses
        // propres tests ; ici on fige seulement leur traduction HTTP.
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
        // Corps présent mais sans URL : traité comme une URL inexploitable,
        // jamais comme une erreur serveur.
        mockMvc.perform(post(LISTING + "/resolve").contentType("application/json").content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INVALID_URL"));
    }
}
