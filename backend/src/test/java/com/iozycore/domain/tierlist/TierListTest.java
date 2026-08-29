package com.iozycore.domain.tierlist;

import org.junit.jupiter.api.Test;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TierListTest {

    @Test
    void creer_une_tier_list_la_date_et_laisse_le_proprietaire_a_la_session() {
        TierList list = TierList.create("Mes mangas préférés", UUID.randomUUID(), EnumSet.of(Rank.S, Rank.A), "Test");

        // Pas de propriétaire choisi ici : la session tranche à l'écriture.
        assertThat(list.ownerId()).isNull();
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
    void a_tier_list_without_an_entity_type_spans_all_universes() {
        // Remplace l'ancienne règle "une Tier List appartient forcément à UN
        // univers" : la maquette V1.2 prévoit un scope 'all' (écart documenté
        // au Lot 7, comblé au Lot 14). Un univers absent n'est plus un oubli,
        // c'est un choix explicite côté client.
        TierList crossUniverse = TierList.create("Mes coups de coeur, tous supports", null, null, null);

        assertThat(crossUniverse.isAllUniverses()).isTrue();
        assertThat(crossUniverse.entityTypeId()).isEmpty();
    }

    @Test
    void a_tier_list_with_an_entity_type_stays_bound_to_that_universe() {
        UUID mangaTypeId = UUID.randomUUID();

        TierList list = TierList.create("Mes mangas", mangaTypeId, null, null);

        assertThat(list.isAllUniverses()).isFalse();
        assertThat(list.entityTypeId()).contains(mangaTypeId);
    }
}
