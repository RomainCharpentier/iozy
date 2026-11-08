package com.iozycore.core.application.share;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityTypeFixtures;
import com.iozycore.core.domain.insights.CollectionValue;
import com.iozycore.core.domain.share.GiftLink;
import com.iozycore.core.domain.share.GiftLinkRepository;
import com.iozycore.core.domain.share.ShareSettings;
import com.iozycore.core.domain.share.ShareSettingsRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.application.insights.SeriesProgressGateway;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SharedSpaceQueryTest {

    private final UUID owner = UUID.randomUUID();
    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryWishlistEntryRepository wishes = new InMemoryWishlistEntryRepository();
    private final List<UUID> readOwners = new ArrayList<>();
    private ShareSettings settings = ShareSettings.withNewToken(owner);

    // Tier lists are never shared in these tests: their collaborators are not needed.
    private final SharedSpaceQuery query = new SharedSpaceQuery(
            new FakeShareSettingsRepository(), entities, new InMemoryEntityTypeRepository(EntityTypeFixtures.MANGA),
            new InMemoryOwnershipRepository(), wishes, null, null,
            new SeriesProgressGateway(List.of()), new RecordingReader(),
            null, new FakeGiftLinkRepository(), null, null);
    private GiftLink gift;

    @Test
    void an_unknown_token_gives_nothing() {
        assertThat(query.read("not-a-token")).isEmpty();
        assertThat(readOwners).isEmpty();
    }

    @Test
    void reads_on_behalf_of_the_owner_named_by_the_token() {
        settings = settings.withSections(false, true).withTierLists(false);

        query.read(settings.token());

        assertThat(readOwners).containsExactly(owner);
    }

    @Test
    void a_section_that_is_not_shared_is_null_not_empty() {
        settings = settings.withSections(false, true).withTierLists(false);

        SharedSpace space = query.read(settings.token()).orElseThrow();

        assertThat(space.collection()).isNull();
        assertThat(space.tierLists()).isNull();
        assertThat(space.wishlist()).isNotNull().isEmpty();
    }

    @Test
    void wishes_are_sorted_by_title_and_an_orphan_wish_is_skipped() {
        settings = settings.withSections(false, true).withTierLists(false);
        Entity zetman = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Zetman"));
        Entity akira = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "akira"));
        wishes.save(WishlistEntry.add(zetman.id(), LocalDate.now()));
        wishes.save(WishlistEntry.add(akira.id(), LocalDate.now()));
        wishes.save(WishlistEntry.add(UUID.randomUUID(), LocalDate.now()));

        SharedSpace space = query.read(settings.token()).orElseThrow();

        assertThat(space.wishlist()).extracting(SharedSpace.SharedWishlistItem::title)
                .containsExactly("akira", "Zetman");
    }

    @Test
    void a_gift_link_shows_the_wishes_only_and_says_until_when() {
        Entity frieren = entities.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Frieren"));
        wishes.save(WishlistEntry.add(frieren.id(), LocalDate.now()));
        gift = GiftLink.issue(owner, Instant.now());

        SharedSpace space = query.read(gift.token()).orElseThrow();

        assertThat(space.giftList()).isTrue();
        assertThat(space.expiresAt()).isEqualTo(gift.expiresAt());
        assertThat(space.wishlist()).extracting(SharedSpace.SharedWishlistItem::title).containsExactly("Frieren");
        // Nothing else leaves through a gift list, whatever the share link shows.
        assertThat(space.collection()).isNull();
        assertThat(space.pinned()).isNull();
        assertThat(space.tierLists()).isNull();
        assertThat(space.value()).isNull();
        assertThat(readOwners).containsExactly(owner);
    }

    @Test
    void an_expired_gift_link_says_so_and_reads_nothing() {
        gift = GiftLink.issue(owner, Instant.now().minus(Duration.ofDays(31)));

        assertThatThrownBy(() -> query.read(gift.token())).isInstanceOf(ShareLinkExpiredException.class);
        assertThat(readOwners).isEmpty();
    }

    @Test
    void the_value_comes_out_only_above_the_threshold_of_prices() {
        BigDecimal total = new BigDecimal("312.40");
        // 4 prices: one odd price would make the number.
        assertThat(SharedSpaceQuery.soundValueOf(new CollectionValue(total, 4, 4, List.of()))).isNull();
        // 5 prices out of 11: the total is the value of a minority.
        assertThat(SharedSpaceQuery.soundValueOf(new CollectionValue(total, 5, 11, List.of()))).isNull();
        // 5 out of 10: enough.
        assertThat(SharedSpaceQuery.soundValueOf(new CollectionValue(total, 5, 10, List.of())))
                .isEqualTo(new SharedSpace.SharedValue(total, 5, 10));
    }

    private class FakeGiftLinkRepository implements GiftLinkRepository {
        @Override
        public Optional<GiftLink> find() {
            return Optional.ofNullable(gift);
        }

        @Override
        public GiftLink save(GiftLink link) {
            gift = link;
            return link;
        }

        @Override
        public void delete() {
            gift = null;
        }

        @Override
        public Optional<GiftLink> findByToken(String token) {
            return Optional.ofNullable(gift).filter(link -> link.matches(token));
        }
    }

    private class FakeShareSettingsRepository implements ShareSettingsRepository {
        @Override
        public ShareSettings find() {
            return settings;
        }

        @Override
        public ShareSettings save(ShareSettings saved) {
            settings = saved;
            return saved;
        }

        @Override
        public Optional<ShareSettings> findByToken(String token) {
            return Optional.of(settings).filter(s -> s.token() != null && s.token().equals(token));
        }
    }

    private class RecordingReader implements ReadOnBehalfOf {
        @Override
        public <T> T run(UUID ownerId, Supplier<T> work) {
            readOwners.add(ownerId);
            return work.get();
        }
    }
}
