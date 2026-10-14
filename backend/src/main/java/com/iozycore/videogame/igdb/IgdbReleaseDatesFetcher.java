package com.iozycore.videogame.igdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.insights.ReleaseDate;
import com.iozycore.core.metadata.TtlCache;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * The release date of a game at IGDB - for the release calendar
 * (batch 146).
 *
 * <h2>What is read, and at what precision</h2>
 * A game has one date per region and per platform ({@code release_dates}),
 * each with its precision: IGDB writes it in {@code human} - "Nov 14,
 * 2026" is a day, "Nov 2026" a month, "2026" or "Q4 2026" or "TBD"
 * are not calendar dates and are ignored. This form,
 * stable for years, is the one read; the {@code category} field that
 * said the same thing is deprecated at IGDB.
 *
 * <h2>Which region</h2>
 * Europe first, then the whole world, then North America, then the
 * rest: a French player waits for the French release, and a game released in
 * Japan six months earlier is not "released" for them. In the chosen
 * region, the most precise date, then the closest one.
 *
 * <h2>One single call for all games</h2>
 * IGDB accepts a list of identifiers: a hundred games, one request. And each
 * response is kept for one day per game - a release date does not change
 * from hour to hour. An outage, on the other hand, is never kept.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IgdbReleaseDatesFetcher implements IgdbReleaseDates {

    private static final String GAMES_URL = "https://api.igdb.com/v4/games";
    private static final String BODY =
            "fields name,release_dates.date,release_dates.human,release_dates.region; where id = (%s); limit %d;";
    static final int IDS_PER_REQUEST = 100;

    private static final Pattern HUMAN_DAY = Pattern.compile("[A-Z][a-z]{2} \\d{1,2}, \\d{4}");
    private static final Pattern HUMAN_MONTH = Pattern.compile("[A-Z][a-z]{2} \\d{4}");
    /** The IGDB regions, by preference: 1 Europe, 8 whole world, 2 North America. */
    private static final List<Integer> PREFERRED_REGIONS = List.of(1, 8, 2);

    @Value("${igdb.client-id:}")
    private String clientId;

    private final IgdbTokenProvider tokenProvider;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TtlCache<String, Optional<ReleaseDate>> memory = new TtlCache<>(Duration.ofHours(24), 2000);

    @Override
    public Map<String, Optional<ReleaseDate>> fetch(Collection<String> igdbIds) {
        Map<String, Optional<ReleaseDate>> result = new HashMap<>();
        List<String> missing = new ArrayList<>();
        for (String id : new LinkedHashSet<>(igdbIds)) {
            Optional<Optional<ReleaseDate>> remembered = memory.get(id);
            if (remembered.isPresent()) {
                result.put(id, remembered.get());
            } else {
                missing.add(id);
            }
        }
        for (int start = 0; start < missing.size(); start += IDS_PER_REQUEST) {
            List<String> batch = missing.subList(start, Math.min(missing.size(), start + IDS_PER_REQUEST));
            Map<String, Optional<ReleaseDate>> fetched = fetchBatch(batch);
            if (fetched == null) {
                break; // an outage: what is already known is enough for this time
            }
            for (String id : batch) {
                // A game missing from the response has no date: kept as is, so as not to ask for it again tomorrow.
                Optional<ReleaseDate> date = fetched.getOrDefault(id, Optional.empty());
                memory.put(id, date);
                result.put(id, date);
            }
        }
        return result;
    }

    /** {@code null} when IGDB did not answer - to be told apart from an answer with no date. */
    private Map<String, Optional<ReleaseDate>> fetchBatch(List<String> igdbIds) {
        try {
            String accessToken = tokenProvider.getAccessToken();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GAMES_URL))
                    .timeout(Duration.ofSeconds(8))
                    .header("Client-ID", clientId)
                    .header("Authorization", "Bearer " + accessToken)
                    .POST(HttpRequest.BodyPublishers.ofString(
                            BODY.formatted(String.join(",", igdbIds), IDS_PER_REQUEST)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("IGDB answered {} for the release dates of {} game(s)", response.statusCode(), igdbIds.size());
                return null;
            }
            return parse(response.body());
        } catch (IgdbUnavailableException e) {
            log.warn("IGDB unavailable for the release dates: {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("IGDB call failed for the release dates: {}", e.getMessage());
            return null;
        }
    }

    Map<String, Optional<ReleaseDate>> parse(String body) throws Exception {
        JsonNode root = objectMapper.readTree(body);
        Map<String, Optional<ReleaseDate>> dates = new HashMap<>();
        for (JsonNode game : root) {
            String id = game.path("id").asText(null);
            if (id == null) {
                continue;
            }
            dates.put(id, bestDate(game.path("release_dates")));
        }
        return dates;
    }

    private static Optional<ReleaseDate> bestDate(JsonNode releaseDates) {
        record Dated(int regionRank, ReleaseDate date) {
        }
        List<Dated> candidates = new ArrayList<>();
        for (JsonNode release : releaseDates) {
            Optional<ReleaseDate> date = dateOf(release);
            if (date.isEmpty()) {
                continue;
            }
            int region = release.path("region").asInt(-1);
            int rank = PREFERRED_REGIONS.indexOf(region);
            candidates.add(new Dated(rank < 0 ? PREFERRED_REGIONS.size() : rank, date.get()));
        }
        return candidates.stream()
                .min(Comparator.comparingInt(Dated::regionRank)
                        .thenComparing(dated -> dated.date().precision() == ReleaseDate.Precision.DAY ? 0 : 1)
                        .thenComparing(Dated::date))
                .map(Dated::date);
    }

    /** The precision is read in {@code human}, the date in {@code date} (Unix seconds, midnight UTC). */
    private static Optional<ReleaseDate> dateOf(JsonNode release) {
        String human = release.path("human").asText("");
        if (!release.path("date").isNumber()) {
            return Optional.empty();
        }
        LocalDate day = Instant.ofEpochSecond(release.path("date").asLong()).atZone(ZoneOffset.UTC).toLocalDate();
        if (HUMAN_DAY.matcher(human).matches()) {
            return Optional.of(ReleaseDate.ofDay(day));
        }
        if (HUMAN_MONTH.matcher(human).matches()) {
            return Optional.of(ReleaseDate.ofMonth(YearMonth.from(day)));
        }
        return Optional.empty();
    }
}
