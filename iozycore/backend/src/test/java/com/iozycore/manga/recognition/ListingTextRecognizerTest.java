package com.iozycore.manga.recognition;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the text of a listing lets us propose, without any external
 * call.
 *
 * <p>This is the main gain of this pass: "Platinum End intégrale tomes 1
 * à 14" is understood for zero euros and zero seconds of waiting. Asking a
 * vision engine to find what the seller wrote in black and white
 * would be paying to guess a piece of information we already have.
 */
class ListingTextRecognizerTest {

    @Test
    void a_complete_run_announced_in_the_title_yields_one_item_per_volume() {
        List<RecognizedItem> propositions =
                ListingTextRecognizer.recognize("Platinum End intégrale tomes 1 à 14", null);

        assertThat(propositions).hasSize(14);
        assertThat(propositions).extracting(RecognizedItem::volumeNumber)
                .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(1, 14).boxed().toList());
        assertThat(propositions).allSatisfy(item ->
                assertThat(item.seriesTitleRaw()).isEqualToIgnoringCase("Platinum End"));
    }

    @Test
    void a_dash_range_is_read_the_same_way() {
        assertThat(ListingTextRecognizer.recognize("Platinum End 1-4", null))
                .extracting(RecognizedItem::volumeNumber)
                .containsExactly(1, 2, 3, 4);
    }

    @Test
    void an_explicit_list_yields_exactly_those_volumes() {
        assertThat(ListingTextRecognizer.recognize("Platinum End tomes 1, 2, 4", null))
                .extracting(RecognizedItem::volumeNumber)
                .containsExactly(1, 2, 4);
    }

    @Test
    void a_vague_listing_never_invents_a_series() {
        // "Beau lot manga" describes no volume. Inventing a complete set from
        // three words would build a verdict computed on volumes
        // that do not exist.
        assertThat(ListingTextRecognizer.recognize("Lot manga", null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("Beau lot de mangas shonen", null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("Lot manga divers 25 pièces", null)).isEmpty();
    }

    @Test
    void volumes_without_an_identifiable_series_yield_nothing() {
        // "lot mangas 1 à 10" gives numbers but no work: ten lines
        // "? tome N" would help nobody.
        assertThat(ListingTextRecognizer.recognize("Lot mangas 1 à 10", null)).isEmpty();
    }

    @Test
    void nothing_at_all_is_a_valid_answer() {
        assertThat(ListingTextRecognizer.recognize(null, null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("", "")).isEmpty();
    }

    @Test
    void the_description_is_read_when_the_title_says_nothing_precise() {
        List<RecognizedItem> propositions = ListingTextRecognizer.recognize(
                "Vinland Saga", "Contient les tomes 1 à 3, très bon état");

        assertThat(propositions).extracting(RecognizedItem::volumeNumber).containsExactly(1, 2, 3);
    }

    @Test
    void a_text_proposal_carries_the_TEXT_source_and_no_photo() {
        RecognizedItem item = ListingTextRecognizer.recognize("Platinum End tome 7", null).get(0);

        assertThat(item.sources()).containsExactly(RecognitionSource.TEXT);
        // We do not invent a photo 0 for it: the text has none.
        assertThat(item.sourceImages()).isEmpty();
    }

    @Test
    void a_text_proposal_says_why_it_exists_without_quoting_the_whole_listing() {
        RecognizedItem item = ListingTextRecognizer.recognize("Platinum End tomes 1 à 14", null).get(0);

        assertThat(item.evidence()).containsExactly("tomes 1 à 14 annoncés dans l'annonce");
    }

    @Test
    void reading_the_text_is_certain_even_though_owning_the_volumes_is_not() {
        // The READING is sure: the sentence says "1 à 14". Whether the seller really has them
        // is another question, carried by the TEXT source.
        RecognizedItem item = ListingTextRecognizer.recognize("Platinum End 1-14", null).get(0);

        assertThat(item.confidence()).isEqualTo(RecognitionConfidence.HIGH);
        assertThat(item.strongestSource()).isEqualTo(RecognitionSource.TEXT);
    }

    @Test
    void an_edition_is_never_INVENTED_from_the_text() {
        // This test used to say "never guessed", which is no longer the rule: the
        // parser now reads the edition when the title NAMES it. What it
        // still does not do, and will not do, is assume one when the
        // title is silent - "Death Note tomes 1 à 6" names none.
        assertThat(ListingTextRecognizer.recognize("Death Note tomes 1 à 6", null))
                .allSatisfy(item -> assertThat(item.editionIsUnknown()).isTrue());
    }

    @Test
    void an_unreasonably_large_lot_is_not_unrolled_into_hundreds_of_rows() {
        // The parser limit accepts up to 300; producing three hundred lines to
        // tick would be unusable. Such a batch is entered another way.
        assertThat(ListingTextRecognizer.recognize("Naruto tomes 1 à 200", null)).isEmpty();
    }

    @Test
    void an_absurd_range_yields_nothing_rather_than_a_single_wrong_volume() {
        assertThat(ListingTextRecognizer.recognize("Lot tomes 1 à 900", null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("Platinum End tomes 14 à 3", null)).isEmpty();
    }

    // ============================= "9 tomes": how many, but not which

    @Test
    void an_announced_count_produces_no_proposal_at_all() {
        // The core of the matter. Unrolling 1 to 9 would be the easy and the
        // wrong move: the seller may have volumes 14 to 22, and a buying
        // verdict computed on invented volumes would be wrong with the confidence
        // of a calculation.
        ListingTextRecognizer.TextReading lecture = ListingTextRecognizer.read("9 tomes de Naruto", null);

        assertThat(lecture.items()).isEmpty();
        assertThat(lecture.announcedVolumeCount()).isEqualTo(9);
        assertThat(lecture.announcedSeriesTitle()).isEqualTo("Naruto");
    }

    @Test
    void the_series_is_named_even_though_no_volume_can_be_proposed() {
        // What the listing REALLY says is kept: the series is named in black
        // and white, only the numbers are missing. Losing it would force
        // the user to retype what the title already contained.
        assertThat(ListingTextRecognizer.read("Lot de 12 tomes One Piece", null).announcedSeriesTitle())
                .isEqualTo("One Piece");
    }

    @Test
    void a_count_without_an_identifiable_work_keeps_the_count_and_drops_the_series() {
        // "lot de 9 mangas" names no work. The number stays true and
        // will serve to check the entry; making up a "mangas" series
        // would help nobody.
        ListingTextRecognizer.TextReading lecture = ListingTextRecognizer.read("Lot de 9 mangas", null);

        assertThat(lecture.items()).isEmpty();
        assertThat(lecture.announcedVolumeCount()).isEqualTo(9);
        assertThat(lecture.announcedSeriesTitle()).isNull();
    }

    @Test
    void explicit_volumes_leave_no_announced_count_behind() {
        ListingTextRecognizer.TextReading lecture = ListingTextRecognizer.read("Naruto tomes 1 à 9", null);

        assertThat(lecture.items()).hasSize(9);
        // Otherwise the screen would show "9 volumes announced" next to nine volumes
        // already identified, as if something were still missing.
        assertThat(lecture.announcedVolumeCount()).isNull();
    }

    @Test
    void a_vague_listing_yields_neither_proposals_nor_a_count() {
        ListingTextRecognizer.TextReading lecture = ListingTextRecognizer.read("Lot manga divers 25 mangas", null);

        assertThat(lecture.items()).isEmpty();
        assertThat(lecture.announcedVolumeCount()).isNull();
    }

    @Test
    void the_legacy_entry_point_still_answers_a_plain_list() {
        // recognize() stays the path for callers that only want the
        // proposals: the new reading does not break the old one.
        assertThat(ListingTextRecognizer.recognize("9 tomes de Naruto", null)).isEmpty();
        assertThat(ListingTextRecognizer.recognize("Platinum End tomes 1 à 3", null)).hasSize(3);
    }

    // ================================ Batches listing SEVERAL series

    @Test
    void two_series_in_one_title_are_read_as_two_series() {
        // Before: three volumes attributed to a series named "Death Note +
        // Bakuman". Two books disappeared from the count - volumes 1-2 of
        // Bakuman, merged into the range 1-3 - and the batch came out cheaper
        // per volume than it really was.
        List<RecognizedItem> propositions = ListingTextRecognizer.recognize("Death Note 1-3 + Bakuman 1-2", null);

        assertThat(propositions).hasSize(5);
        assertThat(propositions).extracting(RecognizedItem::seriesTitleRaw)
                .containsOnly("Death Note", "Bakuman");
        assertThat(propositions).filteredOn(i -> i.seriesTitleRaw().equals("Bakuman"))
                .extracting(RecognizedItem::volumeNumber).containsExactlyInAnyOrder(1, 2);
        assertThat(propositions).filteredOn(i -> i.seriesTitleRaw().equals("Death Note"))
                .extracting(RecognizedItem::volumeNumber).containsExactlyInAnyOrder(1, 2, 3);
    }

    @Test
    void the_usual_separators_all_work() {
        assertThat(ListingTextRecognizer.recognize("Lot Naruto tomes 1 à 5 et Bleach tomes 1 à 3", null))
                .hasSize(8);
        assertThat(ListingTextRecognizer.recognize("One Piece 1-3, Naruto 1-2", null)).hasSize(5);
        assertThat(ListingTextRecognizer.recognize("Death Note tome 1 / Bakuman tome 4", null)).hasSize(2);
    }

    @Test
    void volumes_never_leak_from_one_series_to_the_other() {
        // The core of the matter: each segment is re-read ALONE, its volumes belong
        // only to it. "Death Note tome 1 / Bakuman tome 4" used to say that the
        // batch contained a Death Note 4 - a book that is not there.
        List<RecognizedItem> propositions =
                ListingTextRecognizer.recognize("Death Note tome 1 / Bakuman tome 4", null);

        assertThat(propositions).filteredOn(i -> i.seriesTitleRaw().equals("Death Note"))
                .extracting(RecognizedItem::volumeNumber).containsExactly(1);
        assertThat(propositions).filteredOn(i -> i.seriesTitleRaw().equals("Bakuman"))
                .extracting(RecognizedItem::volumeNumber).containsExactly(4);
    }

    // ---- The safeguard: these separators ALSO serve for something else

    @Test
    void a_comma_separated_list_of_volumes_is_not_a_list_of_series() {
        // "tomes 1, 2, 4": the split would give "tomes 1", "2", "4",
        // none of which carries a work. A single valid series, so we do not
        // touch anything.
        assertThat(ListingTextRecognizer.recognize("Platinum End tomes 1, 2, 4", null))
                .extracting(RecognizedItem::volumeNumber).containsExactly(1, 2, 4);
    }

    @Test
    void a_slash_used_as_a_range_still_reads_as_a_range() {
        assertThat(ListingTextRecognizer.recognize("Platinum End tomes 1/5", null)).hasSize(5);
    }

    @Test
    void a_title_that_merely_contains_a_separator_is_left_alone() {
        // "Jojo's Bizarre Adventure, Part 4": the second segment carries
        // no volume, so a single valid series, so unchanged behaviour.
        List<RecognizedItem> propositions =
                ListingTextRecognizer.recognize("Jojo's Bizarre Adventure, Part 4 tomes 1 à 3", null);

        // Three volumes of ONE single work - "Part 4" belongs to the name of
        // the work, not to a second series. What matters is that there is only
        // one, not the exact way the title is cleaned.
        assertThat(propositions).hasSize(3);
        assertThat(propositions).extracting(RecognizedItem::seriesTitleRaw).hasSize(3);
        assertThat(propositions.stream().map(RecognizedItem::seriesTitleRaw).distinct().toList()).hasSize(1);
    }

    @Test
    void a_single_series_title_is_never_split() {
        assertThat(ListingTextRecognizer.recognize("Platinum End intégrale tomes 1 à 14", null)).hasSize(14);
        assertThat(ListingTextRecognizer.recognize("20th Century Boys tomes 1 à 3", null))
                .extracting(RecognizedItem::seriesTitleRaw).containsOnly("20th Century Boys");
    }

    @Test
    void a_segment_without_an_identifiable_work_does_not_make_a_second_series() {
        // "Naruto 1-3 + TBE": "TBE" is not a work. A single valid series,
        // so the normal reading takes over again.
        assertThat(ListingTextRecognizer.recognize("Naruto 1-3 + TBE", null))
                .extracting(RecognizedItem::seriesTitleRaw).containsOnly("Naruto");
    }

    // ================================ The edition named in the title

    @Test
    void naming_the_edition_no_longer_destroys_the_series() {
        // The real damage before: "Naruto Perfect Edition" came out as
        // a SERIES of that name, which the catalogue does not know - while
        // "Naruto" alone found its work page. Naming the edition, which sellers
        // do all the time, made us lose the series.
        List<RecognizedItem> propositions =
                ListingTextRecognizer.recognize("Naruto Perfect Edition tomes 1 à 3", null);

        assertThat(propositions).hasSize(3);
        assertThat(propositions).extracting(RecognizedItem::seriesTitleRaw).containsOnly("Naruto");
    }

    @Test
    void the_edition_is_carried_as_a_hint_on_every_volume() {
        List<RecognizedItem> propositions =
                ListingTextRecognizer.recognize("Naruto Perfect Edition tomes 1 à 3", null);

        // The edition is a property of the SERIES: the three volumes carry it.
        assertThat(propositions).extracting(RecognizedItem::editionHint)
                .containsOnly("Perfect Edition");
    }

    @Test
    void a_title_that_names_no_edition_leaves_it_unknown() {
        // Nothing is assumed. A missing edition stays missing.
        assertThat(ListingTextRecognizer.recognize("Naruto tomes 1 à 3", null))
                .extracting(RecognizedItem::editionHint).containsOnlyNulls();
    }

    @Test
    void in_a_multi_series_lot_the_edition_belongs_only_to_its_own_series() {
        List<RecognizedItem> propositions = ListingTextRecognizer.recognize(
                "Naruto Perfect Edition 1-2 + Bleach 1-2", null);

        assertThat(propositions).filteredOn(i -> i.seriesTitleRaw().equals("Naruto"))
                .extracting(RecognizedItem::editionHint).containsOnly("Perfect Edition");
        assertThat(propositions).filteredOn(i -> i.seriesTitleRaw().equals("Bleach"))
                .extracting(RecognizedItem::editionHint).containsOnlyNulls();
    }

    @Test
    void a_series_whose_name_looks_like_a_tier_keeps_its_name() {
        // "Black Butler" is not a "Black" edition of "Butler".
        assertThat(ListingTextRecognizer.recognize("Black Butler tomes 1 à 3", null))
                .extracting(RecognizedItem::seriesTitleRaw).containsOnly("Black Butler");
    }
}
