package com.iozycore.core.application.home;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.iozycore.core.application.work.WorkReadModel;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataDetailsService;
import com.iozycore.core.metadata.MetadataSearchService;
import com.iozycore.core.domain.work.WorkView;
import com.iozycore.core.gemini.GeminiRequests;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Recommendations for the home page: works the account does not own and may
 * like. A language model proposes titles from the collection; the catalog
 * sources confirm each one. Without a model, the list is empty and says why.
 */
@Service
public class GuideService {

    private static final Logger log = LoggerFactory.getLogger(GuideService.class);
    private static final ZoneId ZONE = ZoneId.of("Europe/Paris");
    static final int MAX_ANSWER = 700;
    static final int MAX_WORKS = 80;
    private final WorkReadModel works;
    private final EntityTypeRepository entityTypes;
    private final MetadataSearchService search;
    private final MetadataDetailsService details;
    private final Clock clock;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:}")
    private String model;

    public GuideService(WorkReadModel works, EntityTypeRepository entityTypes, MetadataSearchService search,
                        MetadataDetailsService details) {
        this.works = works;
        this.entityTypes = entityTypes;
        this.search = search;
        this.details = details;
        this.clock = Clock.system(ZONE);
    }

    static final int ASKED = 10;
    static final int KEPT = 4;

    static final String RECOMMEND = """
            Voici la collection d'une personne. Propose %d œuvres qu'elle \
            n'a pas et qu'elle a de bonnes chances d'aimer, d'après ce qu'elle possède (ce dont elle a beaucoup \
            de tomes compte davantage).
            Règles impératives :
            - Uniquement des œuvres qui existent réellement et sont connues ; de préférence disponibles en français.
            - Aucune œuvre déjà dans la collection, aucune suite directe, aucun tome ou extension d'une œuvre listée.
            - « type » reprend exactement un de ces libellés : %s. Répartis les propositions entre eux à peu près \
            comme la collection.
            - « pourquoi » est une seule phrase courte, en français, qui tutoie la personne et cite une ou deux \
            œuvres de sa collection qui justifient la proposition. Pas d'emoji.
            Réponds uniquement par cet objet JSON, sans rien autour :
            {"recommandations": [{"titre": "<titre>", "type": "<libellé>", "pourquoi": "<phrase>"}]}

            COLLECTION :
            %s
            """;

    /** One recommended work: found in the catalog sources, with the reason the model gave. */
    public record Recommendation(String title, UUID entityTypeId, String imageUrl, String why) {
    }

    /** The recommendations, whether a model wrote them, and why the list may be empty. */
    public record Recommendations(List<Recommendation> items, boolean ai, String note) {
    }

    /**
     * Works the account does not own and may like. The model proposes titles
     * from the collection; each one is then looked up in the catalog sources of
     * its type, which leave out what is already owned. A title no source knows
     * is dropped: the model can invent a work, the sources cannot. Without a
     * key, or when the model fails, the list is empty and says why.
     */
    public Recommendations recommend() {
        List<WorkView> known = works.works();
        List<WorkView> owned = known.stream().filter(work -> work.ownedCount() > 0).toList();
        if (owned.isEmpty()) {
            return new Recommendations(List.of(), false, "Ajoute quelques œuvres pour recevoir des recommandations.");
        }
        if (apiKey == null || apiKey.isBlank()) {
            return new Recommendations(List.of(), false, "Les recommandations demandent une clé Gemini, absente ici.");
        }
        Map<UUID, EntityType> typesById = entityTypes.findAll().stream()
                .collect(Collectors.toMap(EntityType::id, Function.identity()));
        List<EntityType> usedTypes = owned.stream().map(WorkView::entityTypeId).distinct()
                .map(typesById::get).filter(java.util.Objects::nonNull).toList();
        String labels = usedTypes.stream().map(type -> "« " + type.label() + " »").collect(Collectors.joining(", "));
        String lines = owned.stream().limit(MAX_WORKS)
                .map(work -> "- [" + label(typesById.get(work.entityTypeId())) + "] " + work.title()
                        + " (possédés " + work.ownedCount() + ")")
                .collect(Collectors.joining("\n"));
        String wished = known.stream().filter(work -> work.ownedCount() == 0 && work.wishedCount() > 0)
                .map(WorkView::title).collect(Collectors.joining(", "));
        String collection = wished.isEmpty() ? lines : lines + "\nDÉJÀ DANS SES ENVIES (à ne pas proposer) : " + wished;
        try {
            HttpResponse<String> response = GeminiRequests.send(httpClient, objectMapper, apiKey, model,
                    RECOMMEND.formatted(ASKED, labels, collection));
            if (response.statusCode() != 200) {
                log.warn("Gemini ({}) answered {} to the recommendations: {}", GeminiRequests.effectiveModel(model),
                        response.statusCode(), GeminiRequests.snippet(response.body()));
                return new Recommendations(List.of(), false, "L'IA ne répond pas pour l'instant : réessaie plus tard.");
            }
            JsonNode proposed = objectMapper.readTree(GeminiRequests.extractText(objectMapper, response.body()))
                    .path("recommandations");
            List<Recommendation> kept = verified(proposed, usedTypes, known);
            return new Recommendations(kept, true,
                    kept.isEmpty() ? "Rien de sûr cette fois : redemande d'autres idées." : null);
        } catch (Exception e) {
            log.warn("Recommendations failed: {}", e.getMessage());
            return new Recommendations(List.of(), false, "L'IA ne répond pas pour l'instant : réessaie plus tard.");
        }
    }

    private List<Recommendation> verified(JsonNode proposed, List<EntityType> usedTypes, List<WorkView> owned) {
        Set<String> ownedTitles = owned.stream().map(work -> normalized(work.title())).collect(Collectors.toSet());
        Set<String> seen = new HashSet<>();
        List<Recommendation> kept = new ArrayList<>();
        // One proposal of each type first, then the second of each: the list mixes the categories.
        Map<String, Integer> rankInType = new java.util.HashMap<>();
        List<JsonNode> ordered = new ArrayList<>();
        proposed.forEach(ordered::add);
        Map<JsonNode, Integer> rank = new java.util.IdentityHashMap<>();
        for (JsonNode item : ordered) {
            rank.put(item, rankInType.merge(normalized(item.path("type").asText("")), 1, Integer::sum));
        }
        ordered.sort(Comparator.comparingInt(rank::get));
        for (JsonNode item : ordered) {
            if (kept.size() >= KEPT) {
                break;
            }
            String title = item.path("titre").asText("").trim();
            String wanted = normalized(title);
            EntityType type = usedTypes.stream()
                    .filter(candidate -> normalized(candidate.label()).equals(normalized(item.path("type").asText(""))))
                    .findFirst().orElse(null);
            if (type == null || wanted.length() < 2 || ownedTitles.contains(wanted) || !seen.add(wanted)) {
                continue;
            }
            try {
                List<MetadataCandidate> found = search.search(type, title).stream()
                        .filter(candidate -> candidate.volume() == null)
                        .filter(candidate -> !ownedTitles.contains(normalized(candidate.title())))
                        .toList();
                // The exact title first; a longer or shorter spelling only when no source has it exactly.
                found.stream().filter(candidate -> normalized(candidate.title()).equals(wanted)).findFirst()
                        .or(() -> found.stream().filter(candidate -> sameWork(wanted, normalized(candidate.title()))).findFirst())
                        .ifPresent(candidate -> kept.add(new Recommendation(candidate.title(), type.id(),
                                cover(type, candidate), clean(item.path("pourquoi").asText("")))));
            } catch (RuntimeException e) {
                // A silent source: this title cannot be confirmed, so it is not shown.
                log.warn("Could not confirm the recommendation '{}': {}", title, e.getMessage());
            }
        }
        return kept;
    }

    /** The cover of a candidate; some sources (board games) only give it on a second call. */
    private String cover(EntityType type, MetadataCandidate candidate) {
        if (candidate.imageUrl() != null || candidate.attributes() == null) {
            return candidate.imageUrl();
        }
        try {
            Object found = details.details(type, candidate.attributes()).get("coverImageUrl");
            return found instanceof String url && !url.isBlank() ? url : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static String label(EntityType type) {
        return type == null ? "Autre" : type.label();
    }

    /** Lower case, no accent, letters and digits only: what two spellings of a title share. */
    static String normalized(String text) {
        return Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    /** The source title is the proposed one, or one contains the other (a subtitle, an edition). */
    static boolean sameWork(String wanted, String found) {
        return !found.isEmpty() && (found.equals(wanted) || found.contains(wanted) || wanted.contains(found) && found.length() >= 4);
    }

    /** Plain text, one paragraph, bounded: what the screen shows as is. */
    static String clean(String text) {
        if (text == null) {
            return "";
        }
        String plain = text.replaceAll("[*_`#]", "").replaceAll("\\s+", " ").trim();
        return plain.length() > MAX_ANSWER ? plain.substring(0, MAX_ANSWER - 1).trim() + "…" : plain;
    }
}
