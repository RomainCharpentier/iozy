package com.iozycore.core.application.home;

import com.iozycore.core.application.insights.ReleaseCalendarService;
import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.home.HomeWeek;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.testing.InMemoryEntityRepository;
import com.iozycore.core.testing.InMemoryEntityTypeRepository;
import com.iozycore.core.testing.InMemoryFollowedWorkRepository;
import com.iozycore.core.testing.InMemoryOwnershipRepository;
import com.iozycore.core.testing.InMemoryWishlistEntryRepository;
import com.iozycore.core.testing.InMemoryWorkCollectorStatusRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** The works the home page reads: owned, wished and followed. */
class HomeWeekServiceTest {

    private static final ZoneId PARIS = ZoneId.of("Europe/Paris");
    /**
     * The read model reads its own clock: the release is dated today, always within
     * this week and within the release horizon.
     */
    private static final LocalDate TODAY = LocalDate.now(PARIS);
    private static final EntityType FIGURINES = EntityType.create("FIGURINES", "Figurines", Set.of(), Set.of());

    private final InMemoryEntityRepository entities = new InMemoryEntityRepository();
    private final InMemoryEntityTypeRepository types = new InMemoryEntityTypeRepository(FIGURINES);
    private final InMemoryOwnershipRepository ownerships = new InMemoryOwnershipRepository();
    private final InMemoryWishlistEntryRepository wishes = new InMemoryWishlistEntryRepository();
    private final InMemoryFollowedWorkRepository followed = new InMemoryFollowedWorkRepository();
    private final ReleaseCalendarService calendar = new ReleaseCalendarService(types, entities, ownerships, wishes,
            followed, List.of());
    private final WorkReadModel works = new WorkReadModel(entities, types, ownerships, wishes,
            new InMemoryWorkCollectorStatusRepository(), calendar, List.of(), PARIS.getId());
    private final HomeWeekService service = new HomeWeekService(works, followed, PARIS.getId());

    @Test
    void a_followed_work_neither_owned_nor_wished_leads_with_its_release_this_week() {
        Entity owned = entities.save(Entity.create(FIGURINES.id(), "Statue possédée"));
        ownerships.save(Ownership.acquire(owned.id(), null, OwnershipCondition.NEW, TODAY, null));
        Entity followedWork = Entity.create(FIGURINES.id(), "Statue suivie");
        followedWork.setAttribute(ReleaseCalendarService.RELEASE_DATE_ATTRIBUTE, TODAY.toString());
        entities.save(followedWork);
        followed.save(FollowedWork.follow(followedWork.id(), TODAY));

        HomeWeek week = service.week();

        assertThat(week.lead().work().entityId()).isEqualTo(followedWork.id());
        assertThat(week.lead().reason()).isEqualTo(HomeWeek.Reason.RELEASE);
        assertThat(week.lead().release().date().date()).isEqualTo(TODAY);
        assertThat(week.figure().releasesThisWeek()).isEqualTo(1);
        // Followed only: not a shelf, not "almost done".
        assertThat(week.shelves()).extracting(HomeWeek.Shelf::workCount).containsExactly(1);
        assertThat(week.almostDone()).isEmpty();
    }
}
