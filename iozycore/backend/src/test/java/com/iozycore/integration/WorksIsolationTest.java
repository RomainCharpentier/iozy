package com.iozycore.integration;

import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import com.iozycore.core.domain.work.CollectorStatus;
import com.iozycore.core.domain.work.WorkView;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The works of one account are nobody else's: another account sees none of its
 * works, counts, wishes or collector statuses - on the same shared catalog.
 *
 * <p>Outside a transaction, like {@link IsolationParProprietaireTest}: Hibernate
 * reads the owner when a session opens, so each call is its own request.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class WorksIsolationTest extends PostgresIntegrationTest {

    private static final UUID ALICE = DefaultOwner.ID;
    private static final UUID BOB = UUID.randomUUID();

    @Autowired private WorkReadModel works;
    @Autowired private EntityRepository catalogue;
    @Autowired private OwnershipRepository ownerships;
    @Autowired private WishlistEntryRepository wishes;
    @Autowired private JdbcTemplate jdbc;

    private final List<UUID> createdWorks = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        for (UUID work : createdWorks) {
            for (String table : List.of("ownership", "wishlist_entry", "work_collector_status")) {
                jdbc.update("DELETE FROM " + table + " WHERE entity_id = ?", work);
            }
            jdbc.update("DELETE FROM entity WHERE id = ?", work);
        }
        createdWorks.clear();
        SecurityContextHolder.clearContext();
    }

    private void signIn(UUID account) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AppUserDetailsService.Principal(account, account + "@example.com", "{noop}x", "Compte", false),
                null, List.of()));
    }

    private Entity work(String title) {
        Entity work = catalogue.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(), title + " " + UUID.randomUUID()));
        createdWorks.add(work.id());
        return work;
    }

    @Test
    void another_account_sees_none_of_the_works_counts_wishes_or_statuses() {
        Entity owned = work("Spirit Island");
        Entity wished = work("Terraforming Mars");

        signIn(ALICE);
        ownerships.save(Ownership.acquire(owned.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        wishes.save(WishlistEntry.add(wished.id(), LocalDate.now()));
        works.setCollectorStatus(owned.id(), CollectorStatus.DROPPED);
        long aliceObjects = works.summary().totalObjects();
        assertThat(works.works()).extracting(WorkView::entityId).contains(owned.id(), wished.id());
        assertThat(works.work(owned.id()).collectorStatus()).isEqualTo(CollectorStatus.DROPPED);

        signIn(BOB);
        assertThat(works.works()).extracting(WorkView::entityId).doesNotContain(owned.id(), wished.id());
        WorkView seenByBob = works.work(owned.id());
        assertThat(seenByBob.collectorStatus()).isEqualTo(CollectorStatus.ONGOING);
        assertThat(seenByBob.ownedCount()).isZero();
        assertThat(seenByBob.elements().get(0).element().ownershipId()).isNull();
        assertThat(works.work(wished.id()).wishedCount()).isZero();
        assertThat(works.summary().totalObjects()).isZero();

        // Bob's own status does not touch Alice's.
        works.setCollectorStatus(owned.id(), CollectorStatus.PAUSED);
        signIn(ALICE);
        assertThat(works.work(owned.id()).collectorStatus()).isEqualTo(CollectorStatus.DROPPED);
        assertThat(works.summary().totalObjects()).isEqualTo(aliceObjects);
    }
}
