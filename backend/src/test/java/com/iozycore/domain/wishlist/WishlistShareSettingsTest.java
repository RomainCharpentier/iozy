package com.iozycore.domain.wishlist;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WishlistShareSettingsTest {

    @Test
    void no_link_has_a_null_token_and_reports_no_link() {
        WishlistShareSettings settings = WishlistShareSettings.noLink();

        assertThat(settings.ownerId()).isEqualTo(DefaultOwner.ID);
        assertThat(settings.token()).isNull();
        assertThat(settings.hasLink()).isFalse();
    }

    @Test
    void a_new_token_is_never_blank_and_reports_a_link() {
        WishlistShareSettings settings = WishlistShareSettings.withNewToken();

        assertThat(settings.token()).isNotBlank();
        assertThat(settings.hasLink()).isTrue();
    }

    @Test
    void regenerating_produces_a_different_token_each_time() {
        WishlistShareSettings first = WishlistShareSettings.withNewToken();
        WishlistShareSettings second = WishlistShareSettings.withNewToken();

        assertThat(first.token()).isNotEqualTo(second.token());
    }
}
