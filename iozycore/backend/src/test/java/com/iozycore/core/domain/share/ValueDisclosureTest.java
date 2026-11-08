package com.iozycore.core.domain.share;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ValueDisclosureTest {

    @Test
    void needs_at_least_five_prices() {
        assertThat(ValueDisclosure.isSound(4, 4)).isFalse();
        assertThat(ValueDisclosure.isSound(5, 5)).isTrue();
    }

    @Test
    void needs_at_least_half_of_the_collection_priced() {
        assertThat(ValueDisclosure.isSound(10, 21)).isFalse();
        assertThat(ValueDisclosure.isSound(10, 20)).isTrue();
    }

    @Test
    void an_empty_collection_has_no_value_to_show() {
        assertThat(ValueDisclosure.isSound(0, 0)).isFalse();
    }
}
