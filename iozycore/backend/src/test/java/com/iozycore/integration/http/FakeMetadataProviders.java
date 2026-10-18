package com.iozycore.integration.http;

import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.listing.ListingProvider;
import com.iozycore.core.listing.ListingResolution;
import com.iozycore.core.listing.ListingSnapshot;
import com.iozycore.core.listing.ShippingEstimateKind;
import com.iozycore.core.metadata.BarcodeMetadataProvider;
import com.iozycore.manga.metadata.FrenchTitleMatch;
import com.iozycore.manga.metadata.FrenchTitleProvider;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataProvider;
import com.iozycore.manga.metadata.VolumeCandidate;
import com.iozycore.manga.metadata.VolumeSearchProvider;
import com.iozycore.core.listing.ListingPlatform;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * <b>Fake, deterministic and tiny</b> metadata and listing providers,
 * to test the HTTP boundary without ever touching the network.
 *
 * <h2>How they live together with the real ones</h2>
 * The services inject <b>lists</b> of providers, and each one decides
 * whether it handles a request through {@code supports(...)}. These fakes only answer
 * to a universe dedicated to the tests ({@value #UNIVERS_DE_TEST}) and to a dedicated
 * host ({@value #HOTE_DE_TEST}). The real providers, which only recognise
 * Manga, Board game, Video game and vinted.fr, therefore decline without
 * ever opening a connection: it is their own predicate that rules them out, not
 * a deactivation that would have to be maintained.
 *
 * <h2>Why not WireMock</h2>
 * The point to protect is the incoming HTTP passage, not the outgoing
 * HTTP dialogue. A simulated server would add a dependency and a port to manage in order to
 * test what four classes of twenty lines say better.
 *
 * <h2>Isolation</h2>
 * {@code @TestConfiguration}: these beans are only loaded by the test classes
 * that import them explicitly. No component scan can pick them
 * up, no application profile can activate them.
 */
@TestConfiguration
public class FakeMetadataProviders {

    /** The universe code to which these fakes answer - and that no real provider knows. */
    public static final String UNIVERS_DE_TEST = "ZZFAKE";

    /** The listing host to which the fake ListingProvider answers. */
    public static final String HOTE_DE_TEST = "source-de-test.invalid";

    /**
     * The keywords that trigger a particular behaviour. The test decides
     * the branch by what it asks, without having to reconfigure a bean:
     * the same instance serves all the cases, which avoids a state shared between
     * tests.
     */
    public static final String DECLENCHE_VIDE = "aucun-resultat";
    public static final String DECLENCHE_PANNE = "source-en-panne";
    public static final String DECLENCHE_PARTIEL = "partiel";

    /** The attribute under which the fake search source keeps its own id (BGG keeps "bggId"). */
    public static final String CLE_IDENTIFIANT_DE_TEST = "testId";

    /** The cover that only the details call gives. */
    public static final String COUVERTURE_DES_DETAILS = "https://" + HOTE_DE_TEST + "/details.jpg";

    private static boolean estUniversDeTest(EntityType type) {
        return type != null && UNIVERS_DE_TEST.equals(type.code());
    }

    // ═══════════════════════════════════════════════ Search by title

    @Bean
    MetadataProvider fauxFournisseurDeRecherche() {
        return new MetadataProvider() {
            @Override
            public boolean supports(EntityType entityType) {
                return estUniversDeTest(entityType);
            }

            @Override
            public List<MetadataCandidate> search(String query) {
                if (query.contains(DECLENCHE_PANNE)) {
                    throw new IllegalStateException("Source de test indisponible");
                }
                if (query.contains(DECLENCHE_VIDE)) {
                    return List.of();
                }
                return List.of(new MetadataCandidate("SOURCE_DE_TEST", "fake-1", "Résultat de test : " + query,
                        "https://" + HOTE_DE_TEST + "/couverture.jpg",
                        java.util.Map.of("mangaka", "Autrice de test")));
            }

            /** Details only for a work carrying its test id, like BGG with bggId. */
            @Override
            public java.util.Map<String, Object> details(java.util.Map<String, Object> attributes) {
                Object id = attributes.get(CLE_IDENTIFIANT_DE_TEST);
                if (id == null) {
                    return java.util.Map.of();
                }
                if (id.toString().contains(DECLENCHE_PANNE)) {
                    throw new com.iozycore.core.metadata.SourceUnavailableException("Source de test indisponible");
                }
                return java.util.Map.of("coverImageUrl", COUVERTURE_DES_DETAILS, "minPlayers", 2);
            }
        };
    }

    // ═══════════════════════════════════════════════ Barcode

    @Bean
    BarcodeMetadataProvider fauxFournisseurDeCodeBarres() {
        return new BarcodeMetadataProvider() {
            @Override
            public boolean supports(EntityType entityType) {
                return estUniversDeTest(entityType);
            }

            @Override
            public Optional<MetadataCandidate> lookup(String barcode) {
                if (barcode.contains(DECLENCHE_PANNE)) {
                    throw new IllegalStateException("Source de test indisponible");
                }
                return lookupDetailed(barcode).candidateIfAny();
            }

            /**
             * The two real barcode providers (Google Books, Open Library)
             * distinguish "I answered, I do not know this code" from "I could not
             * answer". This double must be able to say as much, otherwise it
             * falls back on the cautious default of the interface - which concludes NOTHING from an
             * empty result - and makes an observed absence pass for a failure.
             */
            @Override
            public com.iozycore.core.metadata.BarcodeLookup lookupDetailed(String barcode) {
                if (barcode.contains(DECLENCHE_PANNE)) {
                    return com.iozycore.core.metadata.BarcodeLookup.unavailable();
                }
                if (barcode.contains(DECLENCHE_VIDE)) {
                    return com.iozycore.core.metadata.BarcodeLookup.absent();
                }
                return com.iozycore.core.metadata.BarcodeLookup.found(new MetadataCandidate("SOURCE_DE_TEST",
                        "fake-" + barcode, "Trouvé par code-barres", null, java.util.Map.of()));
            }
        };
    }

    // ═══════════════════════════════════════════════ French title

    @Bean
    FrenchTitleProvider fauxFournisseurDeTitreFrancais() {
        return new FrenchTitleProvider() {
            @Override
            public boolean supports(EntityType entityType) {
                return estUniversDeTest(entityType);
            }

            @Override
            public Optional<FrenchTitleMatch> findFrenchTitle(
                    String query, String author, List<String> excludedTitleFragments) {
                if (query.contains(DECLENCHE_PANNE)) {
                    throw new IllegalStateException("Source de test indisponible");
                }
                if (query.contains(DECLENCHE_VIDE)) {
                    return Optional.empty();
                }
                return Optional.of(FrenchTitleMatch.seriesMatched("Titre français de test"));
            }
        };
    }

    // ═══════════════════════════════════════════════ Volumes

    @Bean
    VolumeSearchProvider fauxFournisseurDeTomes() {
        return new VolumeSearchProvider() {
            @Override
            public boolean supports(EntityType entityType) {
                return estUniversDeTest(entityType);
            }

            @Override
            public List<VolumeCandidate> searchVolumes(String seriesTitle, String author,
                                                        List<String> excludedTitleFragments) {
                if (seriesTitle.contains(DECLENCHE_PANNE)) {
                    throw new IllegalStateException("Source de test indisponible");
                }
                if (seriesTitle.contains(DECLENCHE_VIDE)) {
                    return List.of();
                }
                return List.of(
                        new VolumeCandidate("Standard", 1, "https://" + HOTE_DE_TEST + "/t1.jpg", "Tome 1"),
                        new VolumeCandidate("Standard", 2, "https://" + HOTE_DE_TEST + "/t2.jpg", "Tome 2"));
            }
        };
    }

    // ═══════════════════════════════════════════════ Listings

    @Bean
    ListingProvider fauxFournisseurDAnnonce() {
        return new ListingProvider() {
            @Override
            public ListingPlatform platform() {
                return ListingPlatform.OTHER;
            }

            @Override
            public boolean supports(String url) {
                return url != null && url.contains("//" + HOTE_DE_TEST + "/");
            }

            @Override
            public java.util.Set<String> allowedHosts() {
                return java.util.Set.of(HOTE_DE_TEST);
            }

            @Override
            public ListingResolution resolve(String url) {
                if (url.contains(DECLENCHE_PANNE)) {
                    return ListingResolution.failed(ListingResolution.Status.UNAVAILABLE, ListingPlatform.OTHER, url);
                }
                if (url.contains(DECLENCHE_VIDE)) {
                    return ListingResolution.failed(ListingResolution.Status.LISTING_NOT_FOUND, ListingPlatform.OTHER, url);
                }
                if (url.contains(DECLENCHE_PARTIEL)) {
                    // Title and price only: the rest is to be entered. A missing
                    // piece of data is a usable PARTIAL result, not an error.
                    return ListingResolution.partial(new ListingSnapshot(ListingPlatform.OTHER, url, "42",
                            "Lot partiel de test", null, new BigDecimal("30"), "EUR",
                            null, ShippingEstimateKind.UNKNOWN, null, List.of(), Instant.now(),
                            List.of(ListingSnapshot.ListingField.TITLE, ListingSnapshot.ListingField.PRICE)));
                }
                return ListingResolution.success(new ListingSnapshot(ListingPlatform.OTHER, url, "42",
                        "Lot complet de test", "Description de test", new BigDecimal("45"), "EUR",
                        new BigDecimal("3.78"), ShippingEstimateKind.FROM, new BigDecimal("2.95"),
                        List.of("https://" + HOTE_DE_TEST + "/photo1.jpg"), Instant.now(),
                        List.of(ListingSnapshot.ListingField.TITLE, ListingSnapshot.ListingField.DESCRIPTION,
                                ListingSnapshot.ListingField.PRICE, ListingSnapshot.ListingField.SHIPPING_FEE,
                                ListingSnapshot.ListingField.BUYER_PROTECTION_FEE,
                                ListingSnapshot.ListingField.IMAGES)));
            }
        };
    }
}
