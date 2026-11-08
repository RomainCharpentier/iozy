package com.iozycore.core.application.home;

import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.home.HomeWeek;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * The home page "ta semaine" of the signed-in account: the works read model,
 * composed by {@link HomeWeek}. Every count comes from {@link WorkReadModel},
 * so the home page never disagrees with the entity page or the "to buy" page.
 */
@Service
@Transactional(readOnly = true)
public class HomeWeekService {

    private final WorkReadModel works;
    private final Clock clock;

    @Autowired
    public HomeWeekService(WorkReadModel works,
                           @Value("${iozycore.collector-time-zone:Europe/Paris}") String collectorTimeZone) {
        this(works, Clock.system(ZoneId.of(collectorTimeZone)));
    }

    HomeWeekService(WorkReadModel works, Clock clock) {
        this.works = works;
        this.clock = clock;
    }

    public HomeWeek week() {
        return HomeWeek.compose(works.works(), works.summary(), LocalDate.now(clock), clock.getZone());
    }
}
