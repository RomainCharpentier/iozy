package com.iozycore.videogame.igdb;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.insights.ReleaseDate;
import com.iozycore.core.metadata.TtlCache;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * La date de sortie d'un jeu chez IGDB - pour le calendrier des sorties
 * (lot 146).
 *
 * <h2>Ce qui est lu, et à quelle précision</h2>
 * Un jeu porte une date par région et par plateforme ({@code release_dates}),
 * chacune avec sa précision : IGDB l'écrit dans {@code human} - « Nov 14,
 * 2026 » est un jour, « Nov 2026 » un mois, « 2026 » ou « Q4 2026 » ou « TBD »
 * ne sont pas des dates de calendrier et sont ignorés. C'est cette forme,
 * stable depuis des années, qui est lue ; le champ {@code category} qui
 * disait la même chose est déprécié chez IGDB.
 *
 * <h2>Quelle région</h2>
 * L'Europe d'abord, puis le monde entier, puis l'Amérique du Nord, puis le
 * reste : un joueur français attend la sortie française, et un jeu sorti au
 * Japon six mois plus tôt n'est pas « sorti » pour lui. Dans la région
 * retenue, la date la plus précise, puis la plus proche.
 *
 * <h2>Un seul appel pour tous les jeux</h2>
 * IGDB accepte une liste d'identifiants : cent jeux, une requête. Et chaque
 * réponse est retenue un jour par jeu - une date de sortie ne bouge pas
 * d'heure en heure. Une panne, elle, n'est jamais retenue.
 */
@Component
public class IgdbReleaseDatesFetcher implements IgdbReleaseDates {

    private static final Logger log = LoggerFactory.getLogger(IgdbReleaseDatesFetcher.class);
    private static final String GAMES_URL = "https://api.igdb.com/v4/games";
    private static final String BODY =
            "fields name,release_dates.date,release_dates.human,release_dates.region; where id = (%s); limit %d;";
    static final int IDS_PER_REQUEST = 100;

    private static final Pattern HUMAN_DAY = Pattern.compile("[A-Z][a-z]{2} \\d{1,2}, \\d{4}");
    private static final Pattern HUMAN_MONTH = Pattern.compile("[A-Z][a-z]{2} \\d{4}");
    /** Les régions IGDB, par préférence : 1 Europe, 8 monde entier, 2 Amérique du Nord. */
    private static final List<Integer> PREFERRED_REGIONS = List.of(1, 8, 2);

    @Value("${igdb.client-id:}")
    private String clientId;

    private final IgdbTokenProvider tokenProvider;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TtlCache<String, Optional<ReleaseDate>> memory = new TtlCache<>(Duration.ofHours(24), 2000);

    public IgdbReleaseDatesFetcher(IgdbTokenProvider tokenProvider) {
        this.tokenProvider = tokenProvider;
    }

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
                break; // une panne : ce qui est déjà connu suffit pour cette fois
            }
            for (String id : batch) {
                // Un jeu absent de la réponse n'a pas de date : retenu tel quel, pour ne pas le redemander demain.
                Optional<ReleaseDate> date = fetched.getOrDefault(id, Optional.empty());
                memory.put(id, date);
                result.put(id, date);
            }
        }
        return result;
    }

    /** {@code null} quand IGDB n'a pas répondu - à distinguer d'une réponse sans date. */
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
                log.warn("IGDB a répondu {} pour les dates de sortie de {} jeu(x)", response.statusCode(), igdbIds.size());
                return null;
            }
            return parse(response.body());
        } catch (IgdbUnavailableException e) {
            log.warn("IGDB indisponible pour les dates de sortie : {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("Échec de l'appel IGDB pour les dates de sortie : {}", e.getMessage());
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

    /** La précision se lit dans {@code human}, la date dans {@code date} (secondes Unix, minuit UTC). */
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
