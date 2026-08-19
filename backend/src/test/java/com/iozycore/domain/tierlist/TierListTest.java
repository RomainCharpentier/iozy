package com.iozycore.domain.tierlist;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TierListTest {

    @Test
    void creating_a_tier_list_assigns_the_default_owner_and_now() {
        TierList list = TierList.create("Mes mangas préférés", UUID.randomUUID(), EnumSet.of(Rank.S, Rank.A), "Test");

        assertThat(list.ownerId()).isEqualTo(DefaultOwner.ID);
        assertThat(list.name()).isEqualTo("Mes mangas préférés");
        assertThat(list.activeRanks()).containsExactlyInAnyOrder(Rank.S, Rank.A);
        assertThat(list.description()).contains("Test");
        assertThat(list.createdAt()).isNotNull();
    }

    @Test
    void the_name_is_trimmed_and_cannot_be_blank() {
        TierList list = TierList.create("  Ma liste  ", UUID.randomUUID(), null, null);

        assertThat(list.name()).isEqualTo("Ma liste");
        assertThatThrownBy(() -> TierList.create("   ", UUID.randomUUID(), null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void active_ranks_default_to_the_full_scale_when_none_given() {
        TierList list = TierList.create("Ma liste", UUID.randomUUID(), null, null);

        assertThat(list.activeRanks()).containsExactlyInAnyOrderElementsOf(EnumSet.allOf(Rank.class));
    }

    @Test
    void description_is_optional() {
        TierList list = TierList.create("Ma liste", UUID.randomUUID(), null, null);

        assertThat(list.description()).isEmpty();
    }

    @Test
    void rename_trims_and_rejects_blank() {
        TierList list = TierList.create("Ma liste", UUID.randomUUID(), null, null);

        list.rename("  Nouveau nom  ");
        assertThat(list.name()).isEqualTo("Nouveau nom");
        assertThatThrownBy(() -> list.rename("  ")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void active_ranks_cannot_be_emptied() {
        TierList list = TierList.create("Ma liste", UUID.randomUUID(), null, null);

        assertThatThrownBy(() -> list.updateActiveRanks(Set.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> list.updateActiveRanks(null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void a_tier_list_must_belong_to_exactly_one_entity_type() {
        assertThatThrownBy(() -> TierList.create("Ma liste", null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
