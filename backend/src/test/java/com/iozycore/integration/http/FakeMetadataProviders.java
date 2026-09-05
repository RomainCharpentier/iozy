package com.iozycore.integration.http;

import com.iozycore.domain.catalog.EntityType;
import com.iozycore.listing.ListingProvider;
import com.iozycore.listing.ListingResolution;
import com.iozycore.listing.ListingSnapshot;
import com.iozycore.listing.ShippingEstimateKind;
import com.iozycore.metadata.BarcodeMetadataProvider;
import com.iozycore.metadata.manga.FrenchTitleMatch;
import com.iozycore.metadata.manga.FrenchTitleProvider;
import com.iozycore.metadata.MetadataCandidate;
import com.iozycore.metadata.MetadataProvider;
import com.iozycore.metadata.manga.VolumeCandidate;
import com.iozycore.metadata.manga.VolumeSearchProvider;
import com.iozycore.purchaseanalysis.ListingPlatform;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Des fournisseurs de métadonnées et d'annonces <b>faux, déterministes et
 * minuscules</b>, pour tester la frontière HTTP sans jamais toucher au réseau.
 *
 * <h2>Comment ils cohabitent avec les vrais</h2>
 * Les services injectent des <b>listes</b> de fournisseurs, et chacun décide
 * s'il traite une demande via {@code supports(...)}. Ces faux-là ne répondent
 * qu'à un univers dédié aux tests ({@value #UNIVERS_DE_TEST}) et à un hôte
 * dédié ({@value #HOTE_DE_TEST}). Les vrais fournisseurs, qui ne reconnaissent
 * que Manga, Jeu de société, Jeu vidéo et vinted.fr, déclinent donc sans
 * jamais ouvrir de connexion : c'est leur propre prédicat qui les écarte, pas
 * une désactivation qu'il faudrait maintenir.
 *
 * <h2>Pourquoi pas WireMock</h2>
 * Le point à protéger est le passage HTTP entrant, pas le dialogue HTTP
 * sortant. Un serveur simulé ajouterait une dépendance et un port à gérer pour
 * tester ce que quatre classes de vingt lignes disent mieux.
 *
 * <h2>Isolation</h2>
 * {@code @TestConfiguration} : ces beans ne sont chargés que par les classes de
 * test qui les importent explicitement. Aucun scan de composants ne peut les
 * ramasser, aucun profil applicatif ne peut les activer.
 */
@TestConfiguration
public class FakeMetadataProviders {

    /** Le code d'univers auquel ces faux répondent - et qu'aucun vrai fournisseur ne connaît. */
    public static final String UNIVERS_DE_TEST = "ZZFAKE";

    /** L'hôte d'annonce auquel le faux ListingProvider répond. */
    public static final String HOTE_DE_TEST = "source-de-test.invalid";

    /**
     * Les mots-clés qui déclenchent un comportement particulier. Le test décide
     * de la branche par ce qu'il demande, sans avoir à reconfigurer un bean :
     * la même instance sert tous les cas, ce qui évite un état partagé entre
     * tests.
     */
    public static final String DECLENCHE_VIDE = "aucun-resultat";
    public static final String DECLENCHE_PANNE = "source-en-panne";
    public static final String DECLENCHE_PARTIEL = "partiel";

    private static boolean estUniversDeTest(EntityType type) {
        return type != null && UNIVERS_DE_TEST.equals(type.code());
    }

    // ═══════════════════════════════════════════════ Recherche par titre

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
        };
    }

    // ═══════════════════════════════════════════════ Code-barres

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
             * Les deux vrais fournisseurs de code-barres (Google Books, Open Library)
             * distinguent « j'ai répondu, je ne connais pas ce code » de « je n'ai pas
             * pu répondre ». Ce double doit savoir en dire autant, sans quoi il
             * retombe sur le défaut prudent de l'interface - qui ne conclut RIEN d'un
             * vide - et fait passer une absence constatée pour une panne.
             */
            @Override
            public com.iozycore.metadata.BarcodeLookup lookupDetailed(String barcode) {
                if (barcode.contains(DECLENCHE_PANNE)) {
                    return com.iozycore.metadata.BarcodeLookup.unavailable();
                }
                if (barcode.contains(DECLENCHE_VIDE)) {
                    return com.iozycore.metadata.BarcodeLookup.absent();
                }
                return com.iozycore.metadata.BarcodeLookup.found(new MetadataCandidate("SOURCE_DE_TEST",
                        "fake-" + barcode, "Trouvé par code-barres", null, java.util.Map.of()));
            }
        };
    }

    // ═══════════════════════════════════════════════ Titre français

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

    // ═══════════════════════════════════════════════ Tomes

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

    // ═══════════════════════════════════════════════ Annonces

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
                    // Titre et prix seulement : le reste est à saisir. Une donnée
                    // manquante est un résultat PARTIAL utilisable, pas une erreur.
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
