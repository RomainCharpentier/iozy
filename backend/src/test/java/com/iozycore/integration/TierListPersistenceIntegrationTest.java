package com.iozycore.integration;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.tierlist.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Valide le module de persistance Tier Lists (Flyway V12 + JPA) contre un vrai PostgreSQL - mirrors EditionUpgradeWishPersistenceIntegrationTest. */
@Testcontainers
@SpringBootTest
@Transactional
class TierListPersistenceIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("iozycore_test")
            .withUsername("iozycore")
            .withPassword("iozycore");

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private TierListRepository tierListRepository;

    @Autowired
    private TierListItemRepository tierListItemRepository;

    @Autowired
    private EntityRankRepository entityRankRepository;

    @Autowired
    private EntityRepository entityRepository;

    private UUID createMangaEntity() {
        return entityRepository.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Vinland Saga " + UUID.randomUUID())).id();
    }

    @Test
    void a_tier_list_can_be_saved_reloaded_and_deleted_with_its_active_ranks() {
        Set<Rank> ranks = EnumSet.of(Rank.S, Rank.A, Rank.B);
        TierList list = tierListRepository.save(TierList.create("Mangas de guerre", EntityTypeFixtures.MANGA.id(), ranks, "Une note"));

        TierList reloaded = tierListRepository.findById(list.id()).orElseThrow();
        assertThat(reloaded.name()).isEqualTo("Mangas de guerre");
        assertThat(reloaded.activeRanks()).containsExactlyInAnyOrderElementsOf(ranks);
        assertThat(reloaded.description()).contains("Une note");
        assertThat(tierListRepository.findByEntityTypeId(EntityTypeFixtures.MANGA.id()))
                .extracting(TierList::id).contains(list.id());

        tierListRepository.deleteById(list.id());
        assertThat(tierListRepository.findById(list.id())).isEmpty();
    }

    @Test
    void an_item_can_be_added_ranked_then_unranked_without_leaving_the_list() {
        TierList list = tierListRepository.save(TierList.create("Ma liste", EntityTypeFixtures.MANGA.id(), null, null));
        UUID entityId = createMangaEntity();

        TierListItem item = tierListItemRepository.save(TierListItem.add(list.id(), entityId));
        assertThat(item.rank()).isEmpty();
        assertThat(tierListItemRepository.findByTierListId(list.id())).extracting(TierListItem::entityId).containsExactly(entityId);

        item.setRank(Rank.S);
        tierListItemRepository.save(item);
        TierListItem ranked = tierListItemRepository.findByTierListIdAndEntityId(list.id(), entityId).orElseThrow();
        assertThat(ranked.rank()).contains(Rank.S);

        ranked.setRank(null);
        tierListItemRepository.save(ranked);
        TierListItem unranked = tierListItemRepository.findByTierListIdAndEntityId(list.id(), entityId).orElseThrow();
        assertThat(unranked.rank()).isEmpty();
        // Toujours membre de la liste malgré le déclassement (voir la doc de TierListItem.setRank).
        assertThat(tierListItemRepository.findByTierListId(list.id())).hasSize(1);
    }

    @Test
    void deleting_a_tier_list_cascades_to_its_items() {
        TierList list = tierListRepository.save(TierList.create("Ma liste", EntityTypeFixtures.MANGA.id(), null, null));
        UUID entityId = createMangaEntity();
        tierListItemRepository.save(TierListItem.add(list.id(), entityId));

        tierListItemRepository.deleteByTierListId(list.id());
        tierListRepository.deleteById(list.id());

        assertThat(tierListItemRepository.findByTierListId(list.id())).isEmpty();
    }

    @Test
    void an_entity_rank_can_be_saved_reloaded_updated_and_cleared() {
        UUID entityId = createMangaEntity();
        entityRankRepository.save(EntityRank.assign(entityId, Rank.B));

        EntityRank reloaded = entityRankRepository.findByEntityId(entityId).orElseThrow();
        assertThat(reloaded.rank()).isEqualTo(Rank.B);
        assertThat(entityRankRepository.findByEntityIds(Set.of(entityId))).extracting(EntityRank::rank).containsExactly(Rank.B);

        reloaded.updateRank(Rank.S);
        entityRankRepository.save(reloaded);
        assertThat(entityRankRepository.findByEntityId(entityId).orElseThrow().rank()).isEqualTo(Rank.S);

        entityRankRepository.deleteByEntityId(entityId);
        assertThat(entityRankRepository.findByEntityId(entityId)).isEmpty();
    }
}
