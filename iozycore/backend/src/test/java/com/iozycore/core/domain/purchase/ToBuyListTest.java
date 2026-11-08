package com.iozycore.core.domain.purchase;

import com.iozycore.core.domain.insights.ReleaseDate;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkElements;
import com.iozycore.core.domain.work.WorkView;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ToBuyListTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 8);
    private static final UUID TYPE = UUID.randomUUID();

    private static WorkElement volume(int number, WorkElement.State state, ReleaseDate date) {
        return new WorkElement("volume-" + number, "Tome " + number, number, null, state, date, null, null);
    }

    private static WorkElement owned(int number) {
        return new WorkElement("volume-" + number, "Tome " + number, number, null, WorkElement.State.OWNED, null,
                UUID.randomUUID(), UUID.randomUUID());
    }

    private static WorkView work(String title, CollectorStatus status, WorkElement... elements) {
        UUID id = UUID.randomUUID();
        return WorkView.of(id, TYPE, title, null, new WorkElements(id, List.of(elements), null), status, 0, null,
                null, TODAY);
    }

    @Test
    void the_soonest_release_comes_first_then_the_work_closest_to_complete() {
        WorkView farFromComplete = work("Berserk", CollectorStatus.ONGOING, owned(1),
                volume(2, WorkElement.State.MISSING, null), volume(3, WorkElement.State.MISSING, null),
                volume(4, WorkElement.State.MISSING, null));
        WorkView closeToComplete = work("Frieren", CollectorStatus.ONGOING, owned(1),
                volume(2, WorkElement.State.MISSING, null));
        WorkView laterRelease = work("Dandadan", CollectorStatus.ONGOING, owned(1),
                volume(2, WorkElement.State.UPCOMING, ReleaseDate.ofDay(TODAY.plusDays(19))));
        WorkView soonRelease = work("Vinland Saga", CollectorStatus.ONGOING, owned(1),
                volume(2, WorkElement.State.UPCOMING, ReleaseDate.ofDay(TODAY.plusDays(5))));

        List<ToBuyLine> lines = ToBuyList.of(List.of(farFromComplete, closeToComplete, laterRelease, soonRelease),
                TODAY);

        assertThat(lines).extracting(ToBuyLine::title)
                .containsExactly("Vinland Saga", "Dandadan", "Frieren", "Berserk");
        assertThat(lines.get(0).kind()).isEqualTo(ToBuyLine.Kind.UPCOMING);
        assertThat(lines.get(3).kind()).isEqualTo(ToBuyLine.Kind.COMPLETE);
        assertThat(lines.get(3).elements()).extracting(WorkElement::label)
                .containsExactly("Tome 2", "Tome 3", "Tome 4");
    }

    @Test
    void a_paused_work_keeps_only_its_wishes() {
        WorkView paused = work("Kingdom", CollectorStatus.PAUSED, owned(1),
                volume(2, WorkElement.State.MISSING, null), volume(3, WorkElement.State.WANTED, null),
                volume(4, WorkElement.State.UPCOMING, ReleaseDate.ofMonth(YearMonth.from(TODAY))));

        List<ToBuyLine> lines = ToBuyList.of(List.of(paused), TODAY);

        assertThat(lines).hasSize(1);
        assertThat(lines.get(0).kind()).isEqualTo(ToBuyLine.Kind.WISH);
        assertThat(lines.get(0).elements()).extracting(WorkElement::label).containsExactly("Tome 3");
    }

    @Test
    void a_wished_whole_work_is_a_wish_and_a_complete_work_brings_nothing() {
        WorkElement wholeWork = new WorkElement("work", "Catan : Marins", null, null, WorkElement.State.WANTED,
                null, null, null);
        WorkView wished = work("Catan : Marins", CollectorStatus.ONGOING, wholeWork);
        WorkView complete = work("Akira", CollectorStatus.ONGOING, owned(1), owned(2));

        List<ToBuyLine> lines = ToBuyList.of(List.of(wished, complete), TODAY);

        assertThat(lines).extracting(ToBuyLine::title).containsExactly("Catan : Marins");
        assertThat(lines.get(0).kind()).isEqualTo(ToBuyLine.Kind.WISH);
    }
}
