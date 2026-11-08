package com.iozycore.core.api.calendar;

import com.iozycore.core.application.calendar.CalendarFeedQuery;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.DigestUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Optional;

/**
 * The release feed an agenda app subscribes to. No session, on purpose: the app
 * has none, and the token is the password. An unknown or revoked token gives a
 * bare 404, built here rather than thrown: the error handler would write a JSON
 * body, which an app asking only for text/calendar cannot accept. The token is
 * never logged here.
 *
 * <h2>Kind to the apps that poll</h2>
 * Google Agenda and Apple Calendrier read a feed every few hours. The answer
 * carries an ETag (the same releases give the same bytes, see ReleaseIcsWriter)
 * and an hour of private cache: an unchanged feed costs a 304, not a file.
 */
@RestController
@RequestMapping(PublicCalendarController.PATH)
@Tag(name = "Calendar feed", description = "Unauthenticated, reserved for the holder of the link")
@RequiredArgsConstructor
public class PublicCalendarController {

    static final String PATH = "/api/public/calendar";
    static final MediaType TEXT_CALENDAR = new MediaType("text", "calendar", StandardCharsets.UTF_8);

    private final CalendarFeedQuery feedQuery;

    @Operation(summary = "The upcoming releases of the owner of the link, as an iCalendar file. 404 when the link "
            + "does not exist or was revoked.")
    @GetMapping("/{token}.ics")
    public ResponseEntity<String> feed(@PathVariable String token,
                                       @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {
        Optional<String> feed = feedQuery.read(token, LocalDate.now());
        if (feed.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        String ics = feed.get();
        String etag = "\"" + DigestUtils.md5DigestAsHex(ics.getBytes(StandardCharsets.UTF_8)) + "\"";
        CacheControl cache = CacheControl.maxAge(Duration.ofHours(1)).cachePrivate();
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).cacheControl(cache).build();
        }
        return ResponseEntity.ok()
                .contentType(TEXT_CALENDAR)
                .eTag(etag)
                .cacheControl(cache)
                .header("Content-Disposition", "inline; filename=\"iozy-sorties.ics\"")
                .body(ics);
    }
}
