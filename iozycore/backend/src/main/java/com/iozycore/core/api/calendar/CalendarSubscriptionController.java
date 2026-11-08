package com.iozycore.core.api.calendar;

import com.iozycore.core.api.dto.CalendarSubscriptionDtos.CalendarSubscriptionResponse;
import com.iozycore.core.application.calendar.CalendarSubscriptionService;
import com.iozycore.core.domain.calendar.CalendarSubscription;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Subscribe to the release calendar from an agenda app, through a secret link (lot 215). */
@RestController
@RequestMapping("/api/calendar/subscription")
@Tag(name = "Calendar subscription", description = "A secret link that agenda apps read")
@RequiredArgsConstructor
public class CalendarSubscriptionController {

    private final CalendarSubscriptionService service;

    @Operation(summary = "The active subscription link, created when there is none. Idempotent: the same link "
            + "comes back until it is revoked.")
    @PostMapping
    public CalendarSubscriptionResponse subscribe() {
        return toResponse(service.subscribe());
    }

    @Operation(summary = "Revoke the link: its feed answers 404 at once, and the next subscription draws a new one")
    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke() {
        service.revoke();
    }

    private static CalendarSubscriptionResponse toResponse(CalendarSubscription subscription) {
        return new CalendarSubscriptionResponse(subscription.token(),
                PublicCalendarController.PATH + "/" + subscription.token() + ".ics", subscription.createdAt());
    }
}
