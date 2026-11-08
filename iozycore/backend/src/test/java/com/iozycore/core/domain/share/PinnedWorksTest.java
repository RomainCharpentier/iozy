package com.iozycore.core.domain.share;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PinnedWorksTest {

    @Test
    void keeps_up_to_four_works_in_the_order_chosen() {
        List<UUID> ids = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());

        assertThat(new PinnedWorks(ids).entityIds()).containsExactlyElementsOf(ids);
        assertThat(PinnedWorks.none().entityIds()).isEmpty();
    }

    @Test
    void refuses_a_fifth_work_or_the_same_work_twice() {
        List<UUID> five = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID());
        UUID one = UUID.randomUUID();

        assertThatThrownBy(() -> new PinnedWorks(five)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new PinnedWorks(List.of(one, one))).isInstanceOf(IllegalArgumentException.class);
    }
}
