package com.iozycore.videogame.igdb;

import com.iozycore.core.domain.insights.ReleaseDate;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/** IGDB release dates: the precision read from "human", Europe first, nothing approximate. */
class IgdbReleaseDatesFetcherTest {

    private final IgdbReleaseDatesFetcher fetcher = new IgdbReleaseDatesFetcher(null);

    @Test
    void prefers_the_european_day_over_the_worldwide_one_and_over_japan() throws Exception {
        // 1 = Europe, 5 = Japan, 8 = worldwide. 1794476800 = 2026-11-12, 1794649600 = 2026-11-14.
        String body = """
                [ { "id": 1942, "name": "Un jeu",
                    "release_dates": [
                      { "date": 1794476800, "human": "Nov 12, 2026", "region": 5 },
                      { "date": 1794649600, "human": "Nov 14, 2026", "region": 1 },
                      { "date": 1794476800, "human": "Nov 12, 2026", "region": 8 }
                    ] } ]
                """;

        Map<String, Optional<ReleaseDate>> dates = fetcher.parse(body);

        assertThat(dates.get("1942")).contains(ReleaseDate.ofDay(LocalDate.of(2026, 11, 14)));
    }

    @Test
    void keeps_a_month_when_that_is_all_the_source_knows_and_a_day_over_a_month_in_the_same_region() throws Exception {
        // IGDB sets a month-precision date on the last day of the month: 1795996800 = 2026-11-30.
        String body = """
                [ { "id": 1, "name": "Au mois",
                    "release_dates": [ { "date": 1795996800, "human": "Nov 2026", "region": 1 } ] },
                  { "id": 2, "name": "Jour et mois",
                    "release_dates": [ { "date": 1795996800, "human": "Nov 2026", "region": 1 },
                                       { "date": 1794649600, "human": "Nov 14, 2026", "region": 1 } ] } ]
                """;

        Map<String, Optional<ReleaseDate>> dates = fetcher.parse(body);

        assertThat(dates.get("1")).contains(ReleaseDate.ofMonth(YearMonth.of(2026, 11)));
        assertThat(dates.get("2")).contains(ReleaseDate.ofDay(LocalDate.of(2026, 11, 14)));
    }

    @Test
    void answers_empty_for_a_year_a_quarter_a_tbd_or_no_release_dates_at_all() throws Exception {
        String body = """
                [ { "id": 1, "name": "Année", "release_dates": [ { "date": 1798675200, "human": "2026", "region": 1 } ] },
                  { "id": 2, "name": "Trimestre", "release_dates": [ { "date": 1798675200, "human": "Q4 2026", "region": 1 } ] },
                  { "id": 3, "name": "TBD", "release_dates": [ { "human": "TBD", "region": 1 } ] },
                  { "id": 4, "name": "Rien" } ]
                """;

        Map<String, Optional<ReleaseDate>> dates = fetcher.parse(body);

        assertThat(dates).hasSize(4);
        assertThat(dates.values()).allMatch(Optional::isEmpty);
    }

    @Test
    void falls_back_on_any_region_when_none_of_the_preferred_ones_has_a_date() throws Exception {
        String body = """
                [ { "id": 7, "name": "Japon seul",
                    "release_dates": [ { "date": 1794476800, "human": "Nov 12, 2026", "region": 5 } ] } ]
                """;

        assertThat(fetcher.parse(body).get("7")).contains(ReleaseDate.ofDay(LocalDate.of(2026, 11, 12)));
    }
}
