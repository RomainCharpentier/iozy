package com.iozycore.integration;

import com.iozycore.core.application.auth.AppUserDetailsService;
import com.iozycore.core.application.share.ShareService;
import com.iozycore.core.application.share.SharedSpace;
import com.iozycore.core.application.share.SharedSpaceQuery;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.share.GiftLink;
import com.iozycore.core.domain.shared.DefaultOwner;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The pinned works and the gift link of one account are nobody else's (lot 217):
 * another account sees neither, cannot pin a work it does not own, and removing
 * its own gift link leaves the other one working. A gift link shows the wishes
 * of its owner, whoever reads it.
 *
 * <p>Outside a transaction, like {@link WorksIsolationTest}: Hibernate reads the
 * owner when a session opens, so each call is its own request.
 */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class SharePageIsolationTest extends PostgresIntegrationTest {

    private static final UUID ALICE = DefaultOwner.ID;
    private static final UUID BOB = UUID.randomUUID();

    @Autowired private ShareService share;
    @Autowired private SharedSpaceQuery sharedSpace;
    @Autowired private EntityRepository catalogue;
    @Autowired private OwnershipRepository ownerships;
    @Autowired private WishlistEntryRepository wishes;
    @Autowired private JdbcTemplate jdbc;

    private final List<UUID> createdWorks = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM share_pin WHERE owner_id IN (?, ?)", ALICE, BOB);
        jdbc.update("DELETE FROM gift_link WHERE owner_id IN (?, ?)", ALICE, BOB);
        for (UUID work : createdWorks) {
            jdbc.update("DELETE FROM ownership WHERE entity_id = ?", work);
            jdbc.update("DELETE FROM wishlist_entry WHERE entity_id = ?", work);
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
        Entity work = catalogue.save(Entity.create(EntityTypeFixtures.MANGA.id(), title + " " + UUID.randomUUID()));
        createdWorks.add(work.id());
        return work;
    }

    @Test
    void the_pins_of_one_account_are_invisible_to_another_which_cannot_pin_its_works() {
        Entity aliceWork = work("Akira");
        signIn(ALICE);
        ownerships.save(Ownership.acquire(aliceWork.id(), null, OwnershipCondition.NEW, LocalDate.now(), null));
        share.pin(List.of(aliceWork.id()));

        signIn(BOB);
        assertThat(share.pinned().entityIds()).isEmpty();
        // The work is in the shared catalog, but Bob does not own it.
        assertThatThrownBy(() -> share.pin(List.of(aliceWork.id()))).isInstanceOf(IllegalArgumentException.class);
        share.pin(List.of());

        signIn(ALICE);
        assertThat(share.pinned().entityIds()).containsExactly(aliceWork.id());
    }

    @Test
    void a_gift_link_shows_the_wishes_of_its_owner_and_each_account_keeps_its_own() {
        Entity aliceWish = work("Frieren");
        Entity bobWish = work("Dandadan");
        signIn(ALICE);
        wishes.save(WishlistEntry.add(aliceWish.id(), LocalDate.now()));
        GiftLink alice = share.issueOrRenewGiftLink();
        signIn(BOB);
        wishes.save(WishlistEntry.add(bobWish.id(), LocalDate.now()));
        assertThat(share.giftLink()).isEmpty();
        GiftLink bob = share.issueOrRenewGiftLink();
        assertThat(bob.token()).isNotEqualTo(alice.token());

        // A visitor has no account: the token alone names whose wishes are read.
        SecurityContextHolder.clearContext();
        SharedSpace aliceList = sharedSpace.read(alice.token()).orElseThrow();
        assertThat(aliceList.wishlist()).extracting(SharedSpace.SharedWishlistItem::title)
                .contains(aliceWish.title()).doesNotContain(bobWish.title());

        // Bob removes his link: Alice's still answers.
        signIn(BOB);
        share.removeGiftLink();
        SecurityContextHolder.clearContext();
        assertThat(sharedSpace.read(bob.token())).isEmpty();
        assertThat(sharedSpace.read(alice.token())).isPresent();
    }
}
