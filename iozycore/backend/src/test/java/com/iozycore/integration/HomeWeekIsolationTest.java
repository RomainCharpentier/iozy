package com.iozycore.integration;

import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.home.HomeWeekService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.home.HomeWeek;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.DefaultOwner;
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
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The home page of one account shows nothing of another account: no lead, no
 * move, no number, no shelf - on the same shared catalog.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class HomeWeekIsolationTest extends PostgresIntegrationTest {

    private static final UUID ALICE = DefaultOwner.ID;
    private static final UUID BOB = UUID.randomUUID();

    @Autowired private HomeWeekService home;
    @Autowired private EntityRepository catalogue;
    @Autowired private OwnershipRepository ownerships;
    @Autowired private JdbcTemplate jdbc;

    private final List<UUID> createdWorks = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        for (UUID work : createdWorks) {
            jdbc.update("DELETE FROM ownership WHERE entity_id = ?", work);
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

    private static Stream<UUID> worksOn(HomeWeek week) {
        return Stream.of(
                        Stream.ofNullable(week.lead()).map(lead -> lead.work().entityId()),
                        week.alsoThisWeek().stream().map(item -> item.work().entityId()),
                        week.almostDone().stream().map(almost -> almost.work().entityId()),
                        week.shelves().stream().flatMap(shelf -> shelf.covers().stream()).map(w -> w.entityId()))
                .flatMap(s -> s);
    }

    @Test
    void another_account_sees_none_of_my_week() {
        Entity game = catalogue.save(Entity.create(EntityTypeFixtures.BOARD_GAME.id(),
                "Spirit Island " + UUID.randomUUID()));
        createdWorks.add(game.id());

        signIn(ALICE);
        ownerships.save(Ownership.acquire(game.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        HomeWeek mine = home.week();
        assertThat(mine.lead()).isNotNull();
        assertThat(mine.lead().work().entityId()).isEqualTo(game.id());
        assertThat(mine.figure()).isNotNull();
        assertThat(mine.shelves()).isNotEmpty();

        signIn(BOB);
        HomeWeek theirs = home.week();
        assertThat(theirs.lead()).isNull();
        assertThat(theirs.alsoThisWeek()).isEmpty();
        assertThat(theirs.figure()).isNull();
        assertThat(theirs.almostDone()).isEmpty();
        assertThat(theirs.shelves()).isEmpty();
        assertThat(worksOn(theirs)).doesNotContain(game.id());
    }
}
