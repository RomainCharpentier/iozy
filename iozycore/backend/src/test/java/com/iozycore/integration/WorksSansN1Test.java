package com.iozycore.integration;

import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.domain.work.CollectorStatus;
import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * <b>The list of works and the summary must not cost more as the collection grows.</b>
 *
 * <p>The home page and the "to buy" page read every work of the account at
 * once. Same measure as {@link StatsSansN1Test}: the same call on two sizes of
 * collection, and the number of queries must not grow - one read per kind of
 * data, never one per work.
 */
class WorksSansN1Test extends PostgresIntegrationTest {

    @Autowired private WorkReadModel works;
    @Autowired private EntityRepository entityRepository;
    @Autowired private OwnershipRepository ownershipRepository;
    @Autowired private WishlistEntryRepository wishlistEntryRepository;
    @Autowired private EntityManager entityManager;

    @Test
    void the_list_of_works_does_not_cost_more_with_more_works() {
        measureTheSlope(works::works);
    }

    @Test
    void the_summary_does_not_cost_more_with_more_works() {
        measureTheSlope(works::summary);
    }

    private void measureTheSlope(Runnable read) {
        Statistics statistics = entityManager.getEntityManagerFactory()
                .unwrap(SessionFactory.class).getStatistics();
        statistics.setStatisticsEnabled(true);

        addWorks(4);
        long withFew = queriesFor(statistics, read);

        addWorks(5);
        long withMore = queriesFor(statistics, read);

        assertThat(withMore).as("5 more works of every kind must not cost any more query").isEqualTo(withFew);
    }

    private long queriesFor(Statistics statistics, Runnable read) {
        entityManager.flush();
        entityManager.clear();
        long before = statistics.getPrepareStatementCount();
        read.run();
        return statistics.getPrepareStatementCount() - before;
    }

    /** Series with volumes, owned board games with a status, wished games: every kind the list reads. */
    private void addWorks(int count) {
        for (int index = 0; index < count; index++) {
            Entity series = Entity.create(EntityTypeFixtures.MANGA.id(), "Série " + UUID.randomUUID());
            for (int volume = 1; volume <= 3; volume++) {
                series.addVariant("Tome " + volume, Map.of("volumeNumber", volume, "edition", "Standard"));
            }
            entityRepository.save(series);
            for (Variant variant : series.variants()) {
                ownershipRepository.save(Ownership.acquire(series.id(), variant.id(), OwnershipCondition.NEW,
                        LocalDate.now(), null));
            }
            Entity game = entityRepository.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(),
                    "Jeu " + UUID.randomUUID()));
            ownershipRepository.save(Ownership.acquire(game.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
            works.setCollectorStatus(game.id(), CollectorStatus.PAUSED);
            Entity wished = entityRepository.save(Entity.create(EntityTypeFixtures.VIDEO_GAME.id(),
                    "Voulu " + UUID.randomUUID()));
            wishlistEntryRepository.save(WishlistEntry.add(wished.id(), LocalDate.now()));
        }
    }
}
