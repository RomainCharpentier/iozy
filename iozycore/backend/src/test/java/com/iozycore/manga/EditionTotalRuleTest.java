package com.iozycore.manga;

import com.iozycore.manga.domain.EditionTier;
import com.iozycore.manga.domain.MangaEdition;
import com.iozycore.manga.domain.TotalSource;
import com.iozycore.manga.metadata.VolumeCandidate;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** How a French volume list becomes the volume count of one edition. */
class EditionTotalRuleTest {

    private static final Instant NOW = Instant.parse("2026-11-08T10:00:00Z");
    private static final Duration WEEK = Duration.ofDays(7);
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);

    @Test
    void an_ongoing_series_gets_the_highest_french_volume_and_no_finished_flag() {
        Optional<EditionTotalRule.Found> found = EditionTotalRule.fromCandidates("Kana",
                List.of(candidate("Kana", 1), candidate("kana", 12), candidate("Kana", 7)), 3, 20, false, TODAY);

        assertThat(found).contains(new EditionTotalRule.Found(12, false));
    }

    @Test
    void a_finished_series_is_finished_in_france_only_when_the_french_list_reaches_its_count() {
        List<VolumeCandidate> twelve = List.of(candidate("Kana", 1), candidate("Kana", 12));

        assertThat(EditionTotalRule.fromCandidates("Kana", twelve, 1, 12, true, TODAY))
                .contains(new EditionTotalRule.Found(12, true));
        // French run behind the original: the count is what came out so far.
        assertThat(EditionTotalRule.fromCandidates("Kana", twelve, 1, 20, true, TODAY))
                .contains(new EditionTotalRule.Found(12, false));
        // The original count alone is never a French total, nor a finished run.
        assertThat(EditionTotalRule.fromCandidates("Kana", twelve, 1, 12, false, TODAY))
                .contains(new EditionTotalRule.Found(12, false));
        assertThat(EditionTotalRule.fromCandidates("Kana", List.of(), 1, 12, true, TODAY)).isEmpty();
    }

    @Test
    void never_guesses_from_another_edition_or_a_list_shorter_than_the_catalogue() {
        List<VolumeCandidate> candidates = List.of(candidate("Kana", 10), candidate("Perfect Edition", 6));

        assertThat(EditionTotalRule.fromCandidates("Deluxe", candidates, 1, null, false, TODAY)).isEmpty();
        // Accents and case folded, as in the volume search.
        assertThat(EditionTotalRule.fromCandidates("perfect édition", candidates, 2, null, false, TODAY))
                .contains(new EditionTotalRule.Found(6, false));
        // The catalogue already holds volume 8 of the Perfect: the list does not know the whole edition.
        assertThat(EditionTotalRule.fromCandidates("Perfect Edition", candidates, 8, null, false, TODAY)).isEmpty();
    }

    @Test
    void a_manual_total_is_never_overwritten_nor_due() {
        MangaEdition manual = edition(null).withManualTotal(30);

        assertThat(EditionTotalRule.isDue(manual, NOW, WEEK)).isFalse();
        MangaEdition after = EditionTotalRule.apply(manual,
                Optional.of(new EditionTotalRule.Found(42, true)), NOW);
        assertThat(after).isSameAs(manual);
        assertThat(after.totalVolumes()).isEqualTo(30);
        assertThat(after.totalSource()).isEqualTo(TotalSource.MANUAL);
    }

    @Test
    void writes_a_provider_total_and_never_lowers_it() {
        MangaEdition provider = EditionTotalRule.apply(edition(null),
                Optional.of(new EditionTotalRule.Found(12, false)), NOW);
        assertThat(provider.totalVolumes()).isEqualTo(12);
        assertThat(provider.totalSource()).isEqualTo(TotalSource.PROVIDER);
        assertThat(provider.totalCheckedAt()).isEqualTo(NOW);

        MangaEdition grown = EditionTotalRule.apply(provider, Optional.of(new EditionTotalRule.Found(13, false)), NOW);
        assertThat(grown.totalVolumes()).isEqualTo(13);

        MangaEdition shorterList = EditionTotalRule.apply(grown, Optional.of(new EditionTotalRule.Found(9, true)), NOW);
        assertThat(shorterList.totalVolumes()).isEqualTo(13);
        assertThat(shorterList.frenchRunFinished()).isFalse();
    }

    @Test
    void a_volume_announced_for_later_is_not_counted_and_does_not_close_the_run() {
        // Google Books lists the pre-order of the last volume, out next month.
        List<VolumeCandidate> withPreOrder = List.of(dated("Kana", 1, "2025-03-12"), dated("Kana", 11, "2026-10-14"),
                dated("Kana", 12, "2026-12-03"));

        assertThat(EditionTotalRule.fromCandidates("Kana", withPreOrder, 1, 12, true, TODAY))
                .contains(new EditionTotalRule.Found(11, false));
        // Out today: counted, and the run is over.
        assertThat(EditionTotalRule.fromCandidates("Kana", withPreOrder, 1, 12, true, LocalDate.of(2026, 12, 3)))
                .contains(new EditionTotalRule.Found(12, true));
        // A partial date counts once its month or year has come; no date counts as out.
        assertThat(EditionTotalRule.isOut("2026-11", TODAY)).isTrue();
        assertThat(EditionTotalRule.isOut("2026-12", TODAY)).isFalse();
        assertThat(EditionTotalRule.isOut("2026", TODAY)).isTrue();
        assertThat(EditionTotalRule.isOut("2027", TODAY)).isFalse();
        assertThat(EditionTotalRule.isOut(null, TODAY)).isTrue();
    }

    @Test
    void a_partial_answer_writes_the_total_but_keeps_the_edition_due() {
        MangaEdition partial = EditionTotalRule.apply(edition(null),
                Optional.of(new EditionTotalRule.Found(7, false)), NOW, false);

        assertThat(partial.totalVolumes()).isEqualTo(7);
        assertThat(partial.totalSource()).isEqualTo(TotalSource.PROVIDER);
        assertThat(partial.totalCheckedAt()).isNull();
        assertThat(EditionTotalRule.isDue(partial, NOW, WEEK)).isTrue();
    }

    @Test
    void an_answer_without_a_total_only_moves_the_check_time() {
        MangaEdition unknown = edition(null);

        MangaEdition after = EditionTotalRule.apply(unknown, Optional.empty(), NOW);

        assertThat(after.totalVolumes()).isNull();
        assertThat(after.totalSource()).isNull();
        assertThat(after.totalCheckedAt()).isEqualTo(NOW);
    }

    @Test
    void an_edition_is_due_when_missing_never_checked_or_checked_long_ago_but_not_when_finished() {
        assertThat(EditionTotalRule.isDue(null, NOW, WEEK)).isTrue();
        assertThat(EditionTotalRule.isDue(edition(null), NOW, WEEK)).isTrue();
        assertThat(EditionTotalRule.isDue(edition(null).withTotalChecked(NOW.minus(Duration.ofDays(2))), NOW, WEEK))
                .isFalse();
        assertThat(EditionTotalRule.isDue(edition(null).withProviderTotal(5, false, NOW.minus(Duration.ofDays(8))),
                NOW, WEEK)).isTrue();
        assertThat(EditionTotalRule.isDue(edition(null).withProviderTotal(5, true, NOW.minus(Duration.ofDays(80))),
                NOW, WEEK)).isFalse();
    }

    // ------------------------------------------------------------ MangaEdition provenance

    @Test
    void the_patch_keeps_the_source_of_an_unchanged_total_and_marks_a_new_one_manual() {
        MangaEdition provider = edition(null).withProviderTotal(12, false, NOW);

        MangaEdition publisherOnly = provider.withUpdatedReferenceData(null, "Kana", 12, null, null, null, null);
        assertThat(publisherOnly.totalSource()).isEqualTo(TotalSource.PROVIDER);

        MangaEdition typed = provider.withUpdatedReferenceData(null, null, 14, null, null, null, null);
        assertThat(typed.totalSource()).isEqualTo(TotalSource.MANUAL);
        assertThat(typed.totalVolumes()).isEqualTo(14);
    }

    @Test
    void clearing_a_total_forgets_its_source_and_its_check_time() {
        MangaEdition cleared = edition(null).withProviderTotal(12, true, NOW).withManualTotal(null);

        assertThat(cleared.totalVolumes()).isNull();
        assertThat(cleared.totalSource()).isNull();
        assertThat(cleared.frenchRunFinished()).isFalse();
        assertThat(cleared.totalCheckedAt()).isNull();
        assertThat(EditionTotalRule.isDue(cleared, NOW, WEEK)).isTrue();
    }

    @Test
    void a_total_from_before_the_provenance_reads_as_manual() {
        assertThat(edition(9).totalSource()).isEqualTo(TotalSource.MANUAL);
        assertThat(edition(null).totalSource()).isNull();
    }

    private static MangaEdition edition(Integer total) {
        return MangaEdition.create("Pluto", "Kana", EditionTier.STANDARD, null, total, null, false, false, null);
    }

    private static VolumeCandidate dated(String edition, int number, String releaseDate) {
        return new VolumeCandidate(edition, number, null, "Tome " + number, null, null, releaseDate);
    }

    private static VolumeCandidate candidate(String edition, int number) {
        return new VolumeCandidate(edition, number, null, "Tome " + number);
    }
}
