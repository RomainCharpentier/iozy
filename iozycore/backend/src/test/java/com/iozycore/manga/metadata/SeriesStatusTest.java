package com.iozycore.manga.metadata;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** An ongoing series, as each of the three manga databases writes it. */
class SeriesStatusTest {

    @Test
    void recognises_the_three_spellings_of_an_ongoing_series() {
        assertThat(SeriesStatus.isOngoing("RELEASING")).isTrue();          // AniList
        assertThat(SeriesStatus.isOngoing("Publishing")).isTrue();         // Jikan
        assertThat(SeriesStatus.isOngoing("currently_publishing")).isTrue(); // MyAnimeList v2
    }

    @Test
    void anything_else_is_not_ongoing_unknown_included() {
        assertThat(SeriesStatus.isOngoing("FINISHED")).isFalse();
        assertThat(SeriesStatus.isOngoing("On Hiatus")).isFalse();
        assertThat(SeriesStatus.isOngoing("not_yet_published")).isFalse();
        assertThat(SeriesStatus.isOngoing(null)).isFalse();
        assertThat(SeriesStatus.isOngoing(42)).isFalse();
    }
}
