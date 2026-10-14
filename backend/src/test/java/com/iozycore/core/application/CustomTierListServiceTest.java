package com.iozycore.core.application;

import com.iozycore.core.application.CustomTierListService.TierListDetail;
import com.iozycore.core.application.CustomTierListService.TierListSummary;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.testing.InMemoryEntityRankRepository;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryTierListItemRepository;
import com.iozycore.core.testing.InMemoryTierListRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CustomTierListServiceTest {

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryTierListRepository lists = new InMemoryTierListRepository();
    private final InMemoryTierListItemRepository items = new InMemoryTierListItemRepository();
    private final InMemoryEntityRankRepository ranks = new InMemoryEntityRankRepository();

    private final TierListService tierListService = new TierListService(
            entities, new InMemoryOwnershipRepository(), ranks, lists, items);
    private final CustomTierListService service = new CustomTierListService(lists, items, entities,
            new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA), tierListService);

    private final UUID manga = EntityTypeFixtures.MANGA.id();

    @Test
    void refuses_a_blank_name_and_an_unknown_universe() {
        assertThatThrownBy(() -> service.create("  ", manga, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create("Top", UUID.randomUUID(), null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("EntityType inconnu");
    }

    @Test
    void a_list_without_universe_is_listed_with_the_cross_cutting_ones_only() {
        service.create("Tout", null, null, null);
        service.create("Mangas", manga, null, null);

        assertThat(service.listsOf(null)).extracting(s -> s.list().name()).containsExactly("Tout");
        assertThat(service.listsOf(manga)).extracting(s -> s.list().name()).containsExactly("Mangas");
    }

    @Test
    void adding_works_twice_keeps_one_item_each() {
        UUID listId = service.create("Top", manga, null, null).list().id();
        Entity frieren = entities.save(Entity.create(manga, "Frieren"));

        service.addItems(listId, List.of(frieren.id(), frieren.id()));
        TierListDetail detail = service.addItems(listId, List.of(frieren.id())).orElseThrow();

        assertThat(detail.summary().itemCount()).isEqualTo(1);
        assertThat(detail.unranked()).hasSize(1);
    }

    @Test
    void refuses_an_unknown_work_and_an_empty_request() {
        UUID listId = service.create("Top", manga, null, null).list().id();

        assertThatThrownBy(() -> service.addItems(listId, List.of(UUID.randomUUID())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Entité introuvable");
        assertThatThrownBy(() -> service.addItems(listId, List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void an_unknown_list_gives_nothing() {
        UUID unknown = UUID.randomUUID();

        assertThat(service.detail(unknown)).isEmpty();
        assertThat(service.update(unknown, "x", null, null)).isEmpty();
        assertThat(service.addItems(unknown, List.of(UUID.randomUUID()))).isEmpty();
    }

    @Test
    void ranked_works_come_sorted_by_rank_then_the_unranked_ones() {
        UUID listId = service.create("Top", manga, null, null).list().id();
        Entity a = entities.save(Entity.create(manga, "A"));
        Entity b = entities.save(Entity.create(manga, "B"));
        Entity c = entities.save(Entity.create(manga, "C"));
        service.addItems(listId, List.of(a.id(), b.id(), c.id()));

        service.setItemRank(listId, a.id(), Rank.B);
        service.setItemRank(listId, b.id(), Rank.S);

        TierListDetail detail = service.detail(listId).orElseThrow();
        assertThat(detail.ranked()).extracting(e -> e.getValue().title()).containsExactly("B", "A");
        assertThat(detail.unranked()).extracting(e -> e.getValue().title()).containsExactly("C");
        assertThat(detail.summary().rankedCount()).isEqualTo(2);
    }

    @Test
    void ranking_a_work_that_is_not_in_the_list_gives_nothing() {
        UUID listId = service.create("Top", manga, null, null).list().id();
        Entity outside = entities.save(Entity.create(manga, "Dehors"));

        assertThat(service.setItemRank(listId, outside.id(), Rank.A)).isEmpty();
    }

    @Test
    void update_leaves_null_fields_unchanged() {
        UUID listId = service.create("Top", manga, null, "Ma liste").list().id();

        TierListSummary updated = service.update(listId, "Nouveau", null, null).orElseThrow();

        assertThat(updated.list().name()).isEqualTo("Nouveau");
        assertThat(updated.list().description()).contains("Ma liste");
    }

    @Test
    void deleting_a_list_removes_its_items_but_not_the_works() {
        UUID listId = service.create("Top", manga, null, null).list().id();
        Entity frieren = entities.save(Entity.create(manga, "Frieren"));
        service.addItems(listId, List.of(frieren.id()));

        service.delete(listId);

        assertThat(service.detail(listId)).isEmpty();
        assertThat(items.findByEntityId(frieren.id())).isEmpty();
        assertThat(entities.findById(frieren.id())).isPresent();
    }

    @Test
    void general_rank_is_set_changed_then_removed() {
        Entity frieren = entities.save(Entity.create(manga, "Frieren"));

        tierListService.setGeneralRank(frieren.id(), Rank.A);
        tierListService.setGeneralRank(frieren.id(), Rank.S);
        assertThat(tierListService.generalRankOf(frieren.id())).contains(Rank.S);

        tierListService.setGeneralRank(frieren.id(), null);
        assertThat(tierListService.generalRankOf(frieren.id())).isEmpty();
    }

    @Test
    void general_rank_of_an_unknown_work_is_refused() {
        assertThatThrownBy(() -> tierListService.setGeneralRank(UUID.randomUUID(), Rank.A))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
