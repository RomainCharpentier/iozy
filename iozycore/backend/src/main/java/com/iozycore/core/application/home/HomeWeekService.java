package com.iozycore.core.application.home;

import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;
import com.iozycore.core.domain.home.HomeWeek;
import com.iozycore.core.domain.work.WorkView;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The home page "ta semaine" of the signed-in account: the works read model,
 * composed by {@link HomeWeek}. Every count comes from {@link WorkReadModel},
 * so the home page never disagrees with the entity page or the "to buy" page.
 *
 * <p>The works of the page are the owned or wished ones, plus the followed
 * ones: a followed work enters the release calendar, so its release this
 * week belongs on the home page too.
 */
@Service
@Transactional(readOnly = true)
public class HomeWeekService {

    private final WorkReadModel works;
    private final FollowedWorkRepository followedWorks;
    private final Clock clock;

    @Autowired
    public HomeWeekService(WorkReadModel works, FollowedWorkRepository followedWorks,
                           @Value("${iozycore.collector-time-zone:Europe/Paris}") String collectorTimeZone) {
        this(works, followedWorks, Clock.system(ZoneId.of(collectorTimeZone)));
    }

    HomeWeekService(WorkReadModel works, FollowedWorkRepository followedWorks, Clock clock) {
        this.works = works;
        this.followedWorks = followedWorks;
        this.clock = clock;
    }

    public HomeWeek week() {
        List<WorkView> all = new ArrayList<>(works.works());
        Set<UUID> known = all.stream().map(WorkView::entityId).collect(Collectors.toSet());
        Set<UUID> followedOnly = followedWorks.findAll().stream()
                .map(FollowedWork::entityId)
                .filter(id -> !known.contains(id))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        all.addAll(works.works(followedOnly));
        return HomeWeek.compose(all, works.summary(), LocalDate.now(clock), clock.getZone());
    }
}
