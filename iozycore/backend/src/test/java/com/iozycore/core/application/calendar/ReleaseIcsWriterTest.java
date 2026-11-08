package com.iozycore.core.application.calendar;

import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.insights.ReleaseEntry;
import com.iozycore.core.domain.insights.ReleaseEntry.Relation;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ReleaseIcsWriterTest {

    private static final UUID WORK = UUID.randomUUID();
    private static final UUID TYPE = UUID.randomUUID();
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);

    private static ReleaseEntry volume(LocalDate day, int number, Relation relation) {
        return new ReleaseEntry(ReleaseDate.ofDay(day), WORK, "Vinland Saga", TYPE, "Tome " + number + " · Kurokawa",
                number, "Kurokawa", null, relation, "GOOGLE_BOOKS");
    }

    @Test
    void writes_one_all_day_event_per_release_known_to_the_day() {
        String ics = ReleaseIcsWriter.write(List.of(volume(LocalDate.of(2026, 11, 13), 15, Relation.MISSING)), TODAY);

        assertThat(ics).startsWith("BEGIN:VCALENDAR\r\n").endsWith("END:VCALENDAR\r\n");
        assertThat(ics).contains("DTSTART;VALUE=DATE:20261113\r\n", "DTEND;VALUE=DATE:20261114\r\n",
                "SUMMARY:Vinland Saga · Tome 15 · Kurokawa\r\n", "DESCRIPTION:À acheter : il manque à ta collection\r\n",
                "DTSTAMP:20261108T000000Z\r\n");
        assertThat(ics.split("BEGIN:VEVENT", -1)).hasSize(2);
    }

    @Test
    void the_uid_follows_the_volume_not_its_date() {
        String before = ReleaseIcsWriter.uidOf(volume(LocalDate.of(2026, 11, 13), 15, Relation.MISSING));
        String moved = ReleaseIcsWriter.uidOf(volume(LocalDate.of(2026, 12, 4), 15, Relation.OWNED));
        String next = ReleaseIcsWriter.uidOf(volume(LocalDate.of(2026, 11, 13), 16, Relation.MISSING));

        assertThat(moved).isEqualTo(before);
        assertThat(next).isNotEqualTo(before);
        assertThat(before).matches("release-[0-9a-f-]{36}@iozycore");
    }

    @Test
    void leaves_out_a_release_only_known_to_the_month_and_a_duplicate() {
        ReleaseEntry month = new ReleaseEntry(ReleaseDate.ofMonth(YearMonth.of(2026, 12)), UUID.randomUUID(), "Catan",
                TYPE, "", null, null, null, Relation.WANTED, "MANUAL");
        ReleaseEntry day = volume(LocalDate.of(2026, 11, 13), 15, Relation.MISSING);

        String ics = ReleaseIcsWriter.write(List.of(month, day, day), TODAY);

        assertThat(ics).doesNotContain("Catan");
        assertThat(ics.split("BEGIN:VEVENT", -1)).hasSize(2);
    }

    @Test
    void the_same_releases_give_the_same_bytes() {
        List<ReleaseEntry> entries = List.of(volume(LocalDate.of(2026, 11, 13), 15, Relation.MISSING));

        assertThat(ReleaseIcsWriter.write(entries, TODAY)).isEqualTo(ReleaseIcsWriter.write(entries, TODAY));
    }

    @Test
    void escapes_text_and_folds_long_lines_at_75_octets() {
        assertThat(ReleaseIcsWriter.escape("a,b;c\\d\ne")).isEqualTo("a\\,b\\;c\\\\d\\ne");

        String folded = ReleaseIcsWriter.fold("SUMMARY:" + "é".repeat(60));
        for (String line : folded.split("\r\n")) {
            assertThat(line.getBytes(java.nio.charset.StandardCharsets.UTF_8).length).isLessThanOrEqualTo(75);
        }
        assertThat(folded.replace("\r\n ", "")).isEqualTo("SUMMARY:" + "é".repeat(60));
    }
}
