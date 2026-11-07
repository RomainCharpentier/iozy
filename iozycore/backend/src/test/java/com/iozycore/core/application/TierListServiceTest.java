package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListItem;
import com.iozycore.core.testing.InMemoryEntityRankRepository;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryTierListItemRepository;
import com.iozycore.core.testing.InMemoryTierListRepository;
import org.junit.jupiter.api.Test;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TierListServiceTest {

    /** Counts the batch reads, to check that a list is read in one go. */
    private static class CountingEntities extends InMemoryEntityRepository {
        int batchReads;

        @Override
        public List<Entity> findAllById(Collection<UUID> ids) {
            batchReads++;
            return super.findAllById(ids);
        }
    }

    private static class CountingLists extends InMemoryTierListRepository {
        int batchReads;

        @Override
        public List<TierList> findAllById(Collection<UUID> ids) {
            batchReads++;
            return super.findAllById(ids);
        }
    }

    private final CountingEntities entities = new CountingEntities();
    private final CountingLists lists = new CountingLists();
    private final InMemoryTierListItemRepository items = new InMemoryTierListItemRepository();
    private final TierListService service = new TierListService(
            entities, new InMemoryOwnershipRepository(), new InMemoryEntityRankRepository(), lists, items);

    private final UUID manga = EntityTypeFixtures.MANGA.id();

    @Test
    void enriched_items_keep_their_order_skip_deleted_works_and_read_the_works_once() {
        TierList list = lists.save(TierList.create("Top", manga, null, null));
        Entity frieren = entities.save(Entity.create(manga, "Frieren"));
        Entity berserk = entities.save(Entity.create(manga, "Berserk"));
        TierListItem first = items.save(TierListItem.add(list.id(), berserk.id()));
        items.save(TierListItem.add(list.id(), UUID.randomUUID())); // work deleted since
        TierListItem third = items.save(TierListItem.add(list.id(), frieren.id()));

        List<Map.Entry<TierListItem, Entity>> enriched = service.enrichedItems(list.id());

        assertThat(enriched).extracting(Map.Entry::getKey).containsExactly(first, third);
        assertThat(enriched).extracting(e -> e.getValue().title()).containsExactly("Berserk", "Frieren");
        assertThat(entities.batchReads).isEqualTo(1);
    }

    @Test
    void an_empty_list_gives_no_item() {
        TierList list = lists.save(TierList.create("Vide", manga, null, null));

        assertThat(service.enrichedItems(list.id())).isEmpty();
    }

    @Test
    void custom_ranks_keep_only_ranked_items_of_existing_lists_and_read_the_lists_once() {
        Entity frieren = entities.save(Entity.create(manga, "Frieren"));
        TierList top = lists.save(TierList.create("Top", manga, null, null));
        TierList relire = lists.save(TierList.create("À relire", manga, null, null));
        TierList unranked = lists.save(TierList.create("Pas classé", manga, null, null));

        TierListItem inTop = TierListItem.add(top.id(), frieren.id());
        inTop.setRank(Rank.S);
        items.save(inTop);
        TierListItem inRelire = TierListItem.add(relire.id(), frieren.id());
        inRelire.setRank(Rank.B);
        items.save(inRelire);
        items.save(TierListItem.add(unranked.id(), frieren.id()));
        TierListItem inDeletedList = TierListItem.add(UUID.randomUUID(), frieren.id());
        inDeletedList.setRank(Rank.A);
        items.save(inDeletedList);

        List<TierListService.CustomRankEntry> ranks = service.customRanksFor(frieren.id());

        assertThat(ranks).extracting(r -> r.list().name() + ":" + r.rank())
                .containsExactly("Top:S", "À relire:B");
        assertThat(lists.batchReads).isEqualTo(1);
    }
}
