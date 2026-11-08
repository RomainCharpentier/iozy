package com.iozycore.core.application.calendar;

import com.iozycore.core.application.insights.ReleaseCalendarService;
import com.iozycore.core.application.share.ReadOnBehalfOf;
import com.iozycore.core.domain.calendar.CalendarSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Optional;

/**
 * The feed an agenda app reads behind a secret link: the releases of the
 * owner named by the token, as an iCalendar file.
 *
 * <h2>The token names the owner</h2>
 * The app has no session, so the isolation cannot come from one: the releases
 * are read on behalf of the owner of the link ({@link ReadOnBehalfOf}), the same
 * crossing as a share link, written at the place where it happens.
 *
 * <h2>Which period</h2>
 * From a month ago to eleven months ahead. The past month keeps a release the
 * owner just bought in their agenda for a while: an app deletes an event the
 * feed no longer lists.
 */
@Service
@RequiredArgsConstructor
public class CalendarFeedQuery {

    /** Days kept behind today. */
    static final int DAYS_BEFORE = 30;
    /** The whole window: under the one-year bound of the calendar. */
    static final int WINDOW_DAYS = 365;
    /** A token longer than this is not one: answered without touching the database. */
    private static final int MAX_TOKEN_LENGTH = 128;

    private final CalendarSubscriptionRepository repository;
    private final ReleaseCalendarService releaseCalendarService;
    private final ReadOnBehalfOf readOnBehalfOf;

    /** Empty when the link is unknown or revoked. */
    public Optional<String> read(String token, LocalDate today) {
        if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH) {
            return Optional.empty();
        }
        LocalDate from = today.minusDays(DAYS_BEFORE);
        LocalDate to = from.plusDays(WINDOW_DAYS - 1);
        return repository.findActiveByToken(token).map(subscription -> readOnBehalfOf.run(subscription.ownerId(),
                () -> ReleaseIcsWriter.write(releaseCalendarService.releasesBetween(from, to).entries(), today)));
    }
}
