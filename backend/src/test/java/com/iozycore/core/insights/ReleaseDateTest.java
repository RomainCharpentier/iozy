package com.iozycore.core.insights;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The release date: what a source can say, and nothing more. A year
 * alone never enters the calendar - this is the rule of the design
 * journal (§44: "never an approximate date"), and this is where it lives.
 */
class ReleaseDateTest {

    @Test
    void reads_a_full_date_as_a_day_and_a_year_month_as_a_month() {
        assertThat(ReleaseDate.parse("2026-10-14"))
                .contains(ReleaseDate.ofDay(LocalDate.of(2026, 10, 14)));
        assertThat(ReleaseDate.parse(" 2026-10 "))
                .contains(ReleaseDate.ofMonth(YearMonth.of(2026, 10)));
    }

    @Test
    void refuses_anything_that_is_not_a_calendar_date() {
        // A year (BnF "DL 2009", BoardGameGeek), a clumsy entry, a
        // number, nothing: none becomes a date, none throws.
        for (Object value : List.of("2026", "DL 2009", "octobre 2026", "2026-13", "2026-02-30", 2026, "")) {
            assertThat(ReleaseDate.parse(value)).as("%s", value).isEmpty();
        }
        assertThat(ReleaseDate.parse(null)).isEmpty();
    }

    @Test
    void a_month_lies_within_a_period_as_soon_as_one_of_its_days_does() {
        ReleaseDate october = ReleaseDate.ofMonth(YearMonth.of(2026, 10));

        assertThat(october.isWithin(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31))).isTrue();
        assertThat(october.isWithin(LocalDate.of(2026, 10, 20), LocalDate.of(2026, 11, 5))).isTrue();
        assertThat(october.isWithin(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30))).isFalse();
        assertThat(october.isWithin(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30))).isFalse();
    }

    @Test
    void a_day_lies_within_a_period_bounds_included() {
        ReleaseDate day = ReleaseDate.ofDay(LocalDate.of(2026, 10, 14));

        assertThat(day.isWithin(LocalDate.of(2026, 10, 14), LocalDate.of(2026, 10, 14))).isTrue();
        assertThat(day.isWithin(LocalDate.of(2026, 10, 15), LocalDate.of(2026, 10, 31))).isFalse();
    }

    @Test
    void orders_by_date_with_the_whole_month_before_a_precise_first_day() {
        ReleaseDate firstOfOctober = ReleaseDate.ofDay(LocalDate.of(2026, 10, 1));
        ReleaseDate october = ReleaseDate.ofMonth(YearMonth.of(2026, 10));
        ReleaseDate september = ReleaseDate.ofDay(LocalDate.of(2026, 9, 30));

        assertThat(List.of(firstOfOctober, october, september).stream().sorted().toList())
                .containsExactly(september, october, firstOfOctober);
    }

    @Test
    void serialises_at_its_own_precision() {
        assertThat(ReleaseDate.ofDay(LocalDate.of(2026, 10, 14)).iso()).isEqualTo("2026-10-14");
        assertThat(ReleaseDate.ofMonth(YearMonth.of(2026, 10)).iso()).isEqualTo("2026-10");
    }

    @Test
    void a_month_precision_never_carries_a_day() {
        assertThatThrownBy(() -> new ReleaseDate(LocalDate.of(2026, 10, 14), ReleaseDate.Precision.MONTH))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(Optional.of(ReleaseDate.ofMonth(YearMonth.of(2026, 10)).date().getDayOfMonth())).contains(1);
    }
}
