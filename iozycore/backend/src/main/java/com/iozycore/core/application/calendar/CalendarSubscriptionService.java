package com.iozycore.core.application.calendar;

import com.iozycore.core.application.auth.UtilisateurCourant;
import com.iozycore.core.domain.calendar.CalendarSubscription;
import com.iozycore.core.domain.calendar.CalendarSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/** The calendar subscription link, on the owner side. The agenda app side is {@link CalendarFeedQuery}. */
@Service
@RequiredArgsConstructor
public class CalendarSubscriptionService {

    private final CalendarSubscriptionRepository repository;
    private final UtilisateurCourant utilisateurCourant;

    /**
     * The active link, created when there is none. Idempotent: asking twice gives
     * the same link, so a link already pasted into an agenda keeps working.
     */
    @Transactional
    public CalendarSubscription subscribe() {
        return repository.findActive().orElseGet(() -> repository.saveIfNoneActive(
                CalendarSubscription.issue(utilisateurCourant.proprietaire(), Instant.now())));
    }

    /** Revokes the link: the agenda stops receiving releases, and the next link is a new one. */
    @Transactional
    public void revoke() {
        repository.revokeActive(Instant.now());
    }
}
