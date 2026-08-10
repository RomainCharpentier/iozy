package com.iozycore.domain.editionupgrade;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EditionUpgradeWishTest {

    @Test
    void creating_a_wish_assigns_the_default_owner_and_today() {
        EditionUpgradeWish wish = EditionUpgradeWish.create(UUID.randomUUID(), "Standard", "Perfect Edition",
                "Attend une VF");

        assertThat(wish.ownerId()).isEqualTo(DefaultOwner.ID);
        assertThat(wish.addedAt()).isEqualTo(java.time.LocalDate.now());
        assertThat(wish.desiredEditionName()).contains("Perfect Edition");
        assertThat(wish.note()).contains("Attend une VF");
    }

    @Test
    void desired_edition_and_note_are_optional() {
        EditionUpgradeWish wish = EditionUpgradeWish.create(UUID.randomUUID(), "Standard", null, null);

        assertThat(wish.desiredEditionName()).isEmpty();
        assertThat(wish.note()).isEmpty();
    }

    @Test
    void the_current_edition_name_is_trimmed_and_cannot_be_blank() {
        EditionUpgradeWish wish = EditionUpgradeWish.create(UUID.randomUUID(), "  Standard  ", null, null);

        assertThat(wish.currentEditionName()).isEqualTo("Standard");
        assertThatThrownBy(() -> EditionUpgradeWish.create(UUID.randomUUID(), "   ", null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
