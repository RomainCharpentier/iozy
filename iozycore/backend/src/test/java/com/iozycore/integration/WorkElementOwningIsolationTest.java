package com.iozycore.integration;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import com.iozycore.boardgame.expansion.ExpansionCache;
import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.work.WorkElementOwning;
import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkView;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * "Je l'ai" on a derived element (lot 211) writes for the signed-in account
 * only: the expansion becomes a variant of the shared game, but the copy is
 * the account's own, and another account still lacks it.
 *
 * <p>Outside a transaction, like {@link WorksIsolationTest}: Hibernate reads the
 * owner when a session opens, so each call is its own request.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class WorkElementOwningIsolationTest extends PostgresIntegrationTest {

    private static final UUID ALICE = DefaultOwner.ID;
    private static final UUID BOB = UUID.randomUUID();

    @Autowired private WorkElementOwning owning;
    @Autowired private WorkReadModel works;
    @Autowired private EntityRepository catalogue;
    @Autowired private OwnershipRepository ownerships;
    @Autowired private ExpansionCache expansions;
    @Autowired private JdbcTemplate jdbc;

    private UUID createdWork;
    private String createdBggId;

    @AfterEach
    void cleanUp() {
        if (createdWork != null) {
            jdbc.update("DELETE FROM ownership WHERE entity_id = ?", createdWork);
            jdbc.update("DELETE FROM entity WHERE id = ?", createdWork);
        }
        if (createdBggId != null) {
            jdbc.update("DELETE FROM board_game_expansion_cache WHERE base_bgg_id = ?", createdBggId);
        }
        SecurityContextHolder.clearContext();
    }

    private void signIn(UUID account) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AppUserDetailsService.Principal(account, account + "@example.com", "{noop}x", "Compte", false),
                null, List.of()));
    }

    @Test
    void an_expansion_owned_by_one_account_is_still_lacking_for_another() {
        createdBggId = "8" + Math.abs(UUID.randomUUID().getMostSignificantBits() % 1_000_000);
        Entity created = Entity.create(EntityTypeFixtures.BOARD_GAME.id(), "Wingspan " + createdBggId);
        created.setAttribute("bggId", createdBggId);
        Entity game = catalogue.save(created);
        createdWork = game.id();
        expansions.save(createdBggId, List.of(
                new BoardGameExpansion(createdBggId + "1", "Wingspan " + createdBggId + ": European Expansion",
                        null, "2019")), Instant.now());

        signIn(ALICE);
        ownerships.save(Ownership.acquire(game.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        signIn(BOB);
        ownerships.save(Ownership.acquire(game.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));

        WorkView bob = owning.own(game.id(), "bgg-" + createdBggId + "1");
        assertThat(bob.ownedCount()).isEqualTo(2);
        // Twice is once.
        assertThat(owning.own(game.id(), elementKey(bob, "European Expansion")).ownedCount()).isEqualTo(2);

        signIn(ALICE);
        WorkView alice = works.work(game.id());
        assertThat(alice.ownedCount()).isEqualTo(1);
        WorkElement seenByAlice = alice.elements().stream().map(WorkView.CountedElement::element)
                .filter(element -> element.label().equals("European Expansion")).findFirst().orElseThrow();
        assertThat(seenByAlice.state()).isEqualTo(WorkElement.State.MISSING);
        assertThat(seenByAlice.ownershipId()).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM ownership WHERE entity_id = ?", Long.class,
                game.id())).isEqualTo(3L);
    }

    private static String elementKey(WorkView view, String label) {
        return view.elements().stream().map(WorkView.CountedElement::element)
                .filter(element -> element.label().equals(label)).findFirst().orElseThrow().key();
    }
}
