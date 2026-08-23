package com.iozycore.recognition;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Le même tome photographié trois fois ne doit pas devenir trois tomes : sans
 * cette étape, le prix par tome serait divisé par trois et le verdict d'achat
 * calculé sur un lot qui n'existe pas.
 */
class RecognitionConsolidatorTest {

    private static RecognizedItem vu(String titre, Integer tome, RecognitionConfidence confiance, int... photos) {
        return new RecognizedItem(titre, tome, null, null, confiance, List.of(), photosDe(photos));
    }

    private static Set<Integer> photosDe(int... photos) {
        Set<Integer> index = new java.util.TreeSet<>();
        for (int photo : photos) {
            index.add(photo);
        }
        return index;
    }

    @Test
    void the_same_volume_seen_on_three_photos_is_one_item() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Platinum End", 4, RecognitionConfidence.MEDIUM, 0),
                vu("Platinum End", 4, RecognitionConfidence.HIGH, 1),
                vu("Platinum End", 4, RecognitionConfidence.LOW, 2)));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).volumeNumber()).isEqualTo(4);
    }

    @Test
    void a_consolidated_item_remembers_every_photo_that_supported_it() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Platinum End", 4, RecognitionConfidence.MEDIUM, 0),
                vu("Platinum End", 4, RecognitionConfidence.MEDIUM, 2)));

        // L'utilisateur doit pouvoir retourner voir sur quelle image on a lu ça.
        assertThat(consolides.get(0).sourceImages()).containsExactly(0, 2);
    }

    @Test
    void two_photos_showing_the_same_volume_reinforce_each_other() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Platinum End", 4, RecognitionConfidence.LOW, 0),
                vu("Platinum End", 4, RecognitionConfidence.HIGH, 1)));

        assertThat(consolides.get(0).confidence()).isEqualTo(RecognitionConfidence.HIGH);
    }

    @Test
    void casing_accents_and_punctuation_never_split_one_volume_in_two() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Platinum End", 4, RecognitionConfidence.HIGH, 0),
                vu("PLATINUM-END", 4, RecognitionConfidence.HIGH, 1),
                vu("platinum  end", 4, RecognitionConfidence.HIGH, 2)));

        assertThat(consolides).hasSize(1);
    }

    @Test
    void different_volumes_of_the_same_series_stay_separate() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Platinum End", 1, RecognitionConfidence.HIGH, 0),
                vu("Platinum End", 2, RecognitionConfidence.HIGH, 0),
                vu("Platinum End", 3, RecognitionConfidence.HIGH, 1)));

        assertThat(consolides).hasSize(3);
        assertThat(consolides).extracting(RecognizedItem::volumeNumber).containsExactly(1, 2, 3);
    }

    @Test
    void two_series_that_merely_look_alike_are_never_merged() {
        // Rapprocher « Naruto » et « Boruto » par ressemblance ferait bien plus
        // de dégâts que de laisser deux lignes que l'utilisateur fusionne.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Naruto", 1, RecognitionConfidence.HIGH, 0),
                vu("Boruto", 1, RecognitionConfidence.HIGH, 0)));

        assertThat(consolides).hasSize(2);
    }

    // ============================================ Fusion d'édition : A, B, C

    @Test
    void regle_A_an_unread_edition_is_completed_by_the_one_that_was_read() {
        // Photo 1 : édition illisible. Photo 2 : « Standard » lisible.
        // Une édition absente est une information manquante, pas une édition
        // différente : la compléter par la seule lecture disponible n'invente rien.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                new RecognizedItem("Vinland Saga", 7, null, null, RecognitionConfidence.MEDIUM,
                        List.of("« 07 » sur la tranche"), photosDe(0)),
                new RecognizedItem("Vinland Saga", 7, "Standard", null, RecognitionConfidence.HIGH,
                        List.of("mention Standard visible"), photosDe(1))));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).editionHint()).isEqualTo("Standard");
        assertThat(consolides.get(0).sourceImages()).containsExactly(0, 1);
        assertThat(consolides.get(0).evidence())
                .containsExactly("« 07 » sur la tranche", "mention Standard visible");
    }

    @Test
    void regle_A_works_whatever_the_order_the_photos_arrive_in() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                new RecognizedItem("Vinland Saga", 7, "Standard", null, RecognitionConfidence.HIGH, List.of(), photosDe(0)),
                new RecognizedItem("Vinland Saga", 7, null, null, RecognitionConfidence.LOW, List.of(), photosDe(1))));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).editionHint()).isEqualTo("Standard");
    }

    @Test
    void regle_B_two_editions_that_were_both_read_stay_two_items() {
        // Les photos se contredisent : c'est à l'utilisateur de trancher, pas
        // au consolidateur de choisir un gagnant.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                new RecognizedItem("Death Note", 1, "Standard", null, RecognitionConfidence.HIGH, List.of(), photosDe(0)),
                new RecognizedItem("Death Note", 1, "Perfect", null, RecognitionConfidence.HIGH, List.of(), photosDe(1))));

        assertThat(consolides).hasSize(2);
        assertThat(consolides).extracting(RecognizedItem::editionHint)
                .containsExactlyInAnyOrder("Standard", "Perfect");
    }

    @Test
    void regle_C_an_edition_unread_everywhere_stays_unread() {
        // Un seul candidat, et surtout AUCUNE édition inventée : l'écran devra
        // la faire confirmer.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                new RecognizedItem("Berserk", 3, null, null, RecognitionConfidence.MEDIUM, List.of(), photosDe(0)),
                new RecognizedItem("Berserk", 3, null, null, RecognitionConfidence.HIGH, List.of(), photosDe(1))));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).editionIsUnknown()).isTrue();
        assertThat(consolides.get(0).sourceImages()).containsExactly(0, 1);
    }

    @Test
    void an_unread_edition_joins_only_one_of_two_conflicting_readings() {
        // Standard, Perfect, puis une lecture sans édition : trois entrées, deux
        // candidats. La troisième complète l'une des deux, elle n'en crée pas
        // une troisième et ne fusionne pas les deux premières.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                new RecognizedItem("Berserk", 3, "Standard", null, RecognitionConfidence.HIGH, List.of(), photosDe(0)),
                new RecognizedItem("Berserk", 3, "Perfect", null, RecognitionConfidence.HIGH, List.of(), photosDe(1)),
                new RecognizedItem("Berserk", 3, null, null, RecognitionConfidence.LOW, List.of(), photosDe(2))));

        assertThat(consolides).hasSize(2);
        assertThat(consolides).extracting(RecognizedItem::editionHint)
                .containsExactlyInAnyOrder("Standard", "Perfect");
    }

    // ============================================ Ordre déterministe

    @Test
    void source_images_keep_a_deterministic_ascending_order() {
        // Verrou de régression. Set.copyOf(new TreeSet<>(...)) rend un Set NON
        // ordonné : l'écran affichait « vu sur les photos 3 et 1 ». L'ordre est
        // celui que l'utilisateur a sous les yeux, il ne peut pas être aléatoire.
        for (int essai = 0; essai < 50; essai++) {
            RecognizedItem item = new RecognizedItem("Platinum End", 4, null, null,
                    RecognitionConfidence.HIGH, List.of(), photosDe(5, 0, 3, 1, 7, 2));

            assertThat(item.sourceImages()).containsExactly(0, 1, 2, 3, 5, 7);
        }
    }

    @Test
    void merging_across_photos_also_yields_an_ascending_order() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Platinum End", 4, RecognitionConfidence.HIGH, 6),
                vu("Platinum End", 4, RecognitionConfidence.HIGH, 2),
                vu("Platinum End", 4, RecognitionConfidence.HIGH, 4),
                vu("Platinum End", 4, RecognitionConfidence.HIGH, 0)));

        assertThat(consolides.get(0).sourceImages()).containsExactly(0, 2, 4, 6);
    }

    @Test
    void the_same_volume_in_two_editions_stays_two_items() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                new RecognizedItem("Death Note", 1, "Standard", null, RecognitionConfidence.HIGH, List.of(), photosDe(0)),
                new RecognizedItem("Death Note", 1, "Black Edition", null, RecognitionConfidence.HIGH, List.of(), photosDe(0))));

        assertThat(consolides).hasSize(2);
    }

    @Test
    void a_volume_without_a_number_is_never_absorbed_by_a_numbered_one() {
        // « Death Note, tome inconnu » et « Death Note tome 3 » peuvent être le
        // même livre ou deux livres. Rien sur la photo ne tranche : les fusionner
        // inventerait une certitude.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Death Note", 3, RecognitionConfidence.HIGH, 0),
                vu("Death Note", null, RecognitionConfidence.LOW, 1)));

        assertThat(consolides).hasSize(2);
    }

    @Test
    void two_unnumbered_readings_of_the_same_photo_are_one_item() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Death Note", null, RecognitionConfidence.LOW, 0),
                vu("Death Note", null, RecognitionConfidence.MEDIUM, 0)));

        assertThat(consolides).hasSize(1);
    }

    @Test
    void merging_keeps_the_volume_number_read_on_the_clearer_photo() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                new RecognizedItem("Vinland Saga", 7, null, null, RecognitionConfidence.HIGH, List.of("« 07 » sur la tranche"), photosDe(0)),
                new RecognizedItem("Vinland Saga", 7, "Standard", null, RecognitionConfidence.MEDIUM, List.of("titre visible"), photosDe(1))));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).editionHint()).isEqualTo("Standard");
        assertThat(consolides.get(0).evidence()).containsExactly("« 07 » sur la tranche", "titre visible");
    }

    @Test
    void nothing_in_gives_nothing_out() {
        assertThat(RecognitionConsolidator.consolidate(null)).isEmpty();
        assertThat(RecognitionConsolidator.consolidate(List.of())).isEmpty();
    }
}
