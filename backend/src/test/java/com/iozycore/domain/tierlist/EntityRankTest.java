package com.iozycore.domain.tierlist;

import com.iozycore.domain.shared.DefaultOwner;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EntityRankTest {

    @Test
    void assigning_a_rank_sets_the_default_owner_and_now() {
        UUID entityId = UUID.randomUUID();
        EntityRank rank = EntityRank.assign(entityId, Rank.S);

        assertThat(rank.entityId()).isEqualTo(entityId);
        assertThat(rank.ownerId()).isEqualTo(DefaultOwner.ID);
        assertThat(rank.rank()).isEqualTo(Rank.S);
        assertThat(rank.rankedAt()).isNotNull();
    }

    @Test
    void a_rank_can_never_be_null_on_creation() {
        assertThatThrownBy(() -> EntityRank.assign(UUID.randomUUID(), null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updating_the_rank_changes_it_and_the_ranked_at_timestamp() throws InterruptedException {
        EntityRank rank = EntityRank.assign(UUID.randomUUID(), Rank.B);
        Instant firstRankedAt = rank.rankedAt();
        Thread.sleep(2);

        rank.updateRank(Rank.S);

        assertThat(rank.rank()).isEqualTo(Rank.S);
        assertThat(rank.rankedAt()).isAfter(firstRankedAt);
    }

    @Test
    void updating_to_null_is_rejected_use_deletion_instead() {
        EntityRank rank = EntityRank.assign(UUID.randomUUID(), Rank.B);

        assertThatThrownBy(() -> rank.updateRank(null)).isInstanceOf(IllegalArgumentException.class);
    }
}
