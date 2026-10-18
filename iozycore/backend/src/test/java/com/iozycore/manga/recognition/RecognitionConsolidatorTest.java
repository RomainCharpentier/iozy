package com.iozycore.manga.recognition;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The same volume photographed three times must not become three volumes: without
 * this step, the price per volume would be divided by three and the buying verdict
 * computed on a batch that does not exist.
 */
class RecognitionConsolidatorTest {

    private static RecognizedItem vu(String titre, Integer tome, RecognitionConfidence confiance, int... photos) {
        return RecognizedItem.fromVision(titre, tome, null, null, confiance, List.of(), photosDe(photos));
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

        // The user must be able to go back and see on which image this was read.
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
        // Bringing "Naruto" and "Boruto" together by similarity would do far more
        // damage than leaving two lines that the user merges.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                vu("Naruto", 1, RecognitionConfidence.HIGH, 0),
                vu("Boruto", 1, RecognitionConfidence.HIGH, 0)));

        assertThat(consolides).hasSize(2);
    }

    // ============================================ Edition merge: A, B, C

    @Test
    void regle_A_an_unread_edition_is_completed_by_the_one_that_was_read() {
        // Photo 1: unreadable edition. Photo 2: "Standard" readable.
        // A missing edition is missing information, not a different
        // edition: completing it with the only available reading invents nothing.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromVision("Vinland Saga", 7, null, null, RecognitionConfidence.MEDIUM,
                        List.of("« 07 » sur la tranche"), photosDe(0)),
                RecognizedItem.fromVision("Vinland Saga", 7, "Standard", null, RecognitionConfidence.HIGH,
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
                RecognizedItem.fromVision("Vinland Saga", 7, "Standard", null, RecognitionConfidence.HIGH, List.of(), photosDe(0)),
                RecognizedItem.fromVision("Vinland Saga", 7, null, null, RecognitionConfidence.LOW, List.of(), photosDe(1))));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).editionHint()).isEqualTo("Standard");
    }

    @Test
    void regle_B_two_editions_that_were_both_read_stay_two_items() {
        // The photos contradict each other: it is up to the user to decide, not
        // up to the consolidator to pick a winner.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromVision("Death Note", 1, "Standard", null, RecognitionConfidence.HIGH, List.of(), photosDe(0)),
                RecognizedItem.fromVision("Death Note", 1, "Perfect", null, RecognitionConfidence.HIGH, List.of(), photosDe(1))));

        assertThat(consolides).hasSize(2);
        assertThat(consolides).extracting(RecognizedItem::editionHint)
                .containsExactlyInAnyOrder("Standard", "Perfect");
    }

    @Test
    void regle_C_an_edition_unread_everywhere_stays_unread() {
        // A single candidate, and above all NO invented edition: the screen will have to
        // have it confirmed.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromVision("Berserk", 3, null, null, RecognitionConfidence.MEDIUM, List.of(), photosDe(0)),
                RecognizedItem.fromVision("Berserk", 3, null, null, RecognitionConfidence.HIGH, List.of(), photosDe(1))));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).editionIsUnknown()).isTrue();
        assertThat(consolides.get(0).sourceImages()).containsExactly(0, 1);
    }

    @Test
    void an_unread_edition_joins_only_one_of_two_conflicting_readings() {
        // Standard, Perfect, then a reading without an edition: three entries, two
        // candidates. The third completes one of the two, it does not create
        // a third one and does not merge the first two.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromVision("Berserk", 3, "Standard", null, RecognitionConfidence.HIGH, List.of(), photosDe(0)),
                RecognizedItem.fromVision("Berserk", 3, "Perfect", null, RecognitionConfidence.HIGH, List.of(), photosDe(1)),
                RecognizedItem.fromVision("Berserk", 3, null, null, RecognitionConfidence.LOW, List.of(), photosDe(2))));

        assertThat(consolides).hasSize(2);
        assertThat(consolides).extracting(RecognizedItem::editionHint)
                .containsExactlyInAnyOrder("Standard", "Perfect");
    }

    // ============================================ Deterministic order

    @Test
    void source_images_keep_a_deterministic_ascending_order() {
        // Regression lock. Set.copyOf(new TreeSet<>(...)) returns an UNORDERED
        // Set: the screen showed "seen on photos 3 and 1". The order is
        // the one the user has before their eyes, it cannot be random.
        for (int essai = 0; essai < 50; essai++) {
            RecognizedItem item = RecognizedItem.fromVision("Platinum End", 4, null, null,
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
                RecognizedItem.fromVision("Death Note", 1, "Standard", null, RecognitionConfidence.HIGH, List.of(), photosDe(0)),
                RecognizedItem.fromVision("Death Note", 1, "Black Edition", null, RecognitionConfidence.HIGH, List.of(), photosDe(0))));

        assertThat(consolides).hasSize(2);
    }

    @Test
    void a_volume_without_a_number_is_never_absorbed_by_a_numbered_one() {
        // "Death Note, tome inconnu" and "Death Note tome 3" may be the
        // same book or two books. Nothing on the photo decides: merging them
        // would invent a certainty.
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
                RecognizedItem.fromVision("Vinland Saga", 7, null, null, RecognitionConfidence.HIGH, List.of("« 07 » sur la tranche"), photosDe(0)),
                RecognizedItem.fromVision("Vinland Saga", 7, "Standard", null, RecognitionConfidence.MEDIUM, List.of("titre visible"), photosDe(1))));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).editionHint()).isEqualTo("Standard");
        assertThat(consolides.get(0).evidence()).containsExactly("« 07 » sur la tranche", "titre visible");
    }

    @Test
    void nothing_in_gives_nothing_out() {
        assertThat(RecognitionConsolidator.consolidate(null)).isEmpty();
        assertThat(RecognitionConsolidator.consolidate(List.of())).isEmpty();
    }

    // ================ The junction point of the THREE sources

    @Test
    void a_barcode_and_a_listing_line_describing_the_same_volume_become_one() {
        // The barcode batch added a third source without the merge
        // being checked with it. If they did not join up, the same
        // book would count twice - and the price per volume would be wrong, the
        // costliest class of flaw of this module.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromText("Naruto", 9, "tome 9 annoncé dans l'annonce"),
                RecognizedItem.fromEan("Naruto", 9, "9782505011118", "code-barres lu", Set.of(0))));

        assertThat(consolides).hasSize(1);
    }

    @Test
    void merging_never_loses_the_exact_identifier() {
        // This is the whole point of the EAN source: after the merge, the item must
        // stay the carrier of an exact identifier, otherwise the best of the three
        // readings would have been diluted by the other two.
        RecognizedItem fusionne = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromText("Naruto", 9, "annoncé"),
                RecognizedItem.fromEan("Naruto", 9, "9782505011118", "code-barres lu", Set.of(0))))
                .get(0);

        assertThat(fusionne.hasExactIdentifier()).isTrue();
        assertThat(fusionne.ean()).isEqualTo("9782505011118");
    }

    @Test
    void the_barcode_wins_as_the_strongest_source_of_a_merged_item() {
        // The screen shows the strongest source. A volume confirmed by its
        // barcode must present itself as such, not as "listing".
        RecognizedItem fusionne = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromText("Naruto", 9, "annoncé"),
                RecognizedItem.fromEan("Naruto", 9, "9782505011118", "code-barres lu", Set.of(0))))
                .get(0);

        assertThat(fusionne.sources())
                .containsExactlyInAnyOrder(RecognitionSource.TEXT, RecognitionSource.EAN);
        assertThat(fusionne.strongestSource()).isEqualTo(RecognitionSource.EAN);
    }

    @Test
    void the_three_sources_agreeing_still_make_a_single_volume() {
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromText("Naruto", 9, "annoncé"),
                RecognizedItem.fromVision("Naruto", 9, null, null,
                        RecognitionConfidence.MEDIUM, List.of("vu sur la photo"), Set.of(1)),
                RecognizedItem.fromEan("Naruto", 9, "9782505011118", "code-barres lu", Set.of(0))));

        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).sources()).containsExactlyInAnyOrder(
                RecognitionSource.TEXT, RecognitionSource.VISION, RecognitionSource.EAN);
        // The photos of the two visual readings are brought together.
        assertThat(consolides.get(0).sourceImages()).containsExactly(0, 1);
    }

    @Test
    void a_barcode_reading_an_edition_the_photos_did_not_see_completes_it() {
        // An unread edition is missing information, not a different
        // edition: the one that was read completes it.
        RecognizedItem fusionne = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromVision("Naruto", 9, "Kana", null,
                        RecognitionConfidence.MEDIUM, List.of("vu"), Set.of(1)),
                RecognizedItem.fromEan("Naruto", 9, "9782505011118", "code-barres lu", Set.of(0))))
                .get(0);

        assertThat(fusionne.editionHint()).isEqualTo("Kana");
        assertThat(fusionne.hasExactIdentifier()).isTrue();
    }

    @Test
    void two_barcodes_of_different_editions_of_the_same_volume_stay_apart() {
        // Two distinct EANs DESIGNATE two distinct print runs. Merging them
        // would make a book disappear from the count.
        List<RecognizedItem> consolides = RecognitionConsolidator.consolidate(List.of(
                RecognizedItem.fromEan("Naruto", 9, "9782505011118", "code-barres lu", Set.of(0)),
                RecognizedItem.fromEan("Naruto", 9, "9782505078180", "code-barres lu", Set.of(1))));

        // No edition is read on either side: the compatibility rule
        // brings them together. This is the documented behaviour - and the user
        // decides - but the identifier kept stays one of the two, never a
        // mix.
        assertThat(consolides).hasSize(1);
        assertThat(consolides.get(0).ean()).isEqualTo("9782505011118");
    }
}
