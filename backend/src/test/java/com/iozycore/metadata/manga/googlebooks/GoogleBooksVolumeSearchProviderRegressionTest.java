package com.iozycore.metadata.manga.googlebooks;

import com.iozycore.metadata.manga.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

/**
 * Contrairement à {@link GoogleBooksVolumeSearchProviderTest} (une réponse =
 * un mot-clé = un test), cette classe rejoue le pipeline COMPLET de
 * {@code searchVolumes} : plusieurs réponses simulées (une par mot-clé,
 * comme {@code QUICK_EDITION_KEYWORDS}) fusionnées via
 * {@link GoogleBooksVolumeSearchProvider#mergeAndFinalize} - dédoublonnage
 * PUIS résolution one-shot PUIS filtre anti-bruit, dans cet ordre exact.
 * <p>
 * Raison d'être (voir historique de la conversation) : chaque bug corrigé
 * cette session avait sa propre preuve unitaire, mais le bug "Sword Art
 * Online" (numérotation sans mot-clé ET filtre anti-bruit trop strict)
 * n'était visible qu'à travers l'INTERACTION des deux, invisible en testant
 * chaque étape isolément - cette classe fige ces interactions déjà
 * constatées en production pour qu'un futur correctif localisé ne les
 * recasse pas silencieusement à distance.
 */
class GoogleBooksVolumeSearchProviderRegressionTest {

    private final GoogleBooksVolumeSearchProvider provider = new GoogleBooksVolumeSearchProvider();

    /** Simule {@code runKeywordSearches} : une réponse par mot-clé, combinées
     * avant fusion - jamais {@code parse()} (une seule réponse, saute
     * {@code filterOutNoiseEditions}, voir sa javadoc). */
    private List<VolumeCandidate> searchAcrossKeywords(String seriesTitle, List<String> excludedTitleFragments, String... bodies) throws Exception {
        List<VolumeCandidate> combined = new ArrayList<>();
        for (String body : bodies) {
            combined.addAll(provider.extractCandidates(body, seriesTitle, excludedTitleFragments, null));
        }
        return GoogleBooksVolumeSearchProvider.mergeAndFinalize(combined);
    }

    @Test
    void sword_art_online_keeps_three_sparsely_covered_arcs_numbered_without_a_tome_keyword() throws Exception {
        // Reproduit le cas réel intégral (voir historique) : 3 mots-clés
        // différents remontent chacun UN SEUL tome, réparti sur 3 arcs
        // distincts ("Aincrad" collé sans mot-clé, "Progressive" et
        // "Ordinal Scale" avec "Tome N") - sans le repli numérotation nue
        // NI l'assouplissement du filtre anti-bruit, ce test échouait
        // (résultat vide).
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Sword Art Online 001 Aincrad", "language": "fr", "publisher": "Ofelbe" } }
                ] }
                """;
        String perfectEditionKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Sword Art Online Progressive Tome 2", "language": "fr" } },
                    { "volumeInfo": { "title": "Sword Art Online - Ordinal Scale Tome 4", "language": "fr" } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("Sword Art Online", List.of(), blankKeyword, perfectEditionKeyword);

        assertThat(result).extracting(VolumeCandidate::edition, VolumeCandidate::volumeNumber)
                .containsExactlyInAnyOrder(tuple("Aincrad", 1), tuple("Progressive", 2), tuple("Ordinal Scale", 4));
    }

    @Test
    void one_piece_discards_a_single_hit_spin_off_while_deduping_the_solidly_represented_edition_across_keywords() throws Exception {
        // "Kana" apparaît dans DEUX mots-clés différents pour le même tome 1
        // (une fois sans jaquette, une fois avec) - doit fusionner en UNE
        // entrée AVEC jaquette (voir dedupeAndSort), tandis que "One Piece
        // Party" (un seul tome, faux positif de la recherche plein texte)
        // doit être écarté puisque "Kana" est solidement représentée (3+
        // tomes, voir filterOutNoiseEditions).
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "One Piece - Tome 1", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "One Piece - Tome 2", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "One Piece - Tome 3", "language": "fr", "publisher": "Kana" } },
                    { "volumeInfo": { "title": "One Piece Party - Tome 1", "language": "fr" } }
                ] }
                """;
        String editionOriginaleKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "One Piece - Tome 1", "language": "fr", "publisher": "Kana",
                        "imageLinks": { "thumbnail": "http://books.google.com/op1.jpg" } } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("One Piece", List.of(), blankKeyword, editionOriginaleKeyword);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("Kana");
        assertThat(result).hasSize(3);
        VolumeCandidate tome1 = result.stream().filter(c -> c.volumeNumber() == 1).findFirst().orElseThrow();
        assertThat(tome1.imageUrl()).isEqualTo("https://books.google.com/op1.jpg");
    }

    @Test
    void dragon_ball_excludes_sd_and_super_regardless_of_which_keyword_surfaces_them_while_merging_perfect_edition() throws Exception {
        // "SD" et "Super" (spin-off/suite connus, voir RelatedSeriesService)
        // ressortent sur des mots-clés DIFFÉRENTS de "Perfect Edition" - la
        // recherche approfondie ne doit exclure QUE les fragments connus,
        // jamais toucher aux tomes légitimes trouvés par ailleurs, même
        // combinés depuis plusieurs mots-clés.
        List<String> excludedTitleFragments = List.of("Dragon Ball SD", "Dragon Ball Super");
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Dragon Ball SD - Tome 01", "language": "fr",
                        "imageLinks": { "thumbnail": "http://books.google.com/sd1.jpg" } } },
                    { "volumeInfo": { "title": "Dragon Ball Super nº 18", "language": "fr" } },
                    { "volumeInfo": { "title": "Dragon Ball perfect edition - Tome 01", "language": "fr" } }
                ] }
                """;
        String perfectEditionKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Dragon Ball perfect edition - Tome 02", "language": "fr" } },
                    { "volumeInfo": { "title": "Dragon Ball perfect edition - Tome 03", "language": "fr" } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("Dragon Ball", excludedTitleFragments, blankKeyword, perfectEditionKeyword);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("Perfect Edition");
        assertThat(result).extracting(VolumeCandidate::volumeNumber).containsExactlyInAnyOrder(1, 2, 3);
    }

    @Test
    void fairy_tail_excludes_100_years_quest_sequel_across_keywords() throws Exception {
        // "100 Years Quest" (tagué "sequel" sur MyAnimeList, voir historique)
        // ressort sur PLUSIEURS mots-clés à la fois - doit rester exclu quel
        // que soit celui qui le trouve, sans affecter "L'intégrale".
        List<String> excludedTitleFragments = List.of("100 Years Quest");
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Fairy Tail - 100 years quest Tome 5", "language": "fr" } },
                    { "volumeInfo": { "title": "Fairy Tail L'intégrale Tome 1", "language": "fr" } },
                    { "volumeInfo": { "title": "Fairy Tail L'intégrale Tome 2", "language": "fr" } }
                ] }
                """;
        String editionOriginaleKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "Fairy Tail - 100 years quest Tome 6", "language": "fr" } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("Fairy Tail", excludedTitleFragments, blankKeyword, editionOriginaleKeyword);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("L'intégrale");
    }

    @Test
    void city_hunter_excludes_the_historical_alias_while_keeping_the_real_integrale_across_keywords() throws Exception {
        // "(Nicky Larson)" est un alias historique collé au titre de série
        // (voir skipLeadingAliasNotResemblingAnEdition), jamais un nom
        // d'édition - doit rester invisible même mélangé à une vraie
        // édition trouvée sur un AUTRE mot-clé.
        String blankKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "City Hunter (Nicky Larson) - Tome 1", "language": "fr", "publisher": "Panini Manga" } },
                    { "volumeInfo": { "title": "City Hunter (Nicky Larson) - Tome 2", "language": "fr", "publisher": "Panini Manga" } }
                ] }
                """;
        String integraleKeyword = """
                { "items": [
                    { "volumeInfo": { "title": "City Hunter (Intégrale) - Tome 1", "language": "fr" } },
                    { "volumeInfo": { "title": "City Hunter (Intégrale) - Tome 2", "language": "fr" } }
                ] }
                """;

        List<VolumeCandidate> result = searchAcrossKeywords("City Hunter", List.of(), blankKeyword, integraleKeyword);

        assertThat(result).extracting(VolumeCandidate::edition).containsOnly("Panini", "Intégrale");
    }
}
