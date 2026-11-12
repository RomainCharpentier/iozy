package com.iozycore.core.application.work;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.work.WorkElement;
import com.iozycore.core.domain.work.WorkView;
import com.iozycore.core.gemini.GeminiRequests;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * What a work is about, and where the collector stopped: a short summary
 * without spoilers, and, for a numbered series, a reminder of the story up to
 * the last volume owned and nothing beyond it.
 *
 * <h2>A language model writes it, and may be wrong</h2>
 * The model only gets the title, the type and the volume number. It is told to
 * say so when it does not know the work rather than to guess; the screen marks
 * the text as written by an AI. Without a key, or when the call fails, there
 * is no text and the answer says why.
 *
 * <h2>Kept in memory</h2>
 * The text depends on the title, the type and the volume only, not on the
 * account: it is kept in memory so that a page opened twice asks once.
 */
@Service
public class WorkStoryService {

    private static final Logger log = LoggerFactory.getLogger(WorkStoryService.class);
    static final int MAX_TEXT = 900;
    static final int MAX_KEPT = 500;

    static final String PROMPT = """
            Œuvre : « %s » (catégorie : %s).
            Écris en français, en tutoyant, en texte simple (pas de liste, pas de markdown).
            Réponds uniquement par cet objet JSON, sans rien autour :
            {"connue": <true ou false>, "resume": "<texte>", "jusquIci": <"<texte>" ou null>}
            - « connue » : false si tu ne connais pas précisément cette œuvre ou si le titre est ambigu dans cette \\
            catégorie. Dans ce cas laisse les deux textes vides : ne devine jamais.
            - « resume » : 2 à 3 phrases qui disent de quoi parle l'œuvre et ce qui fait son intérêt, sans rien \\
            dévoiler de l'intrigue au-delà du point de départ.
            %s
            """;

    static final String SO_FAR = """
            - « jusquIci » : 3 à 5 phrases qui rappellent ce qui s'est passé jusqu'au tome %d inclus, pour quelqu'un \\
            qui reprend la série. Ne révèle rien de ce qui arrive après le tome %d. Si tu n'es pas sûr du découpage \\
            par tome, reste général sur le début de l'histoire et dis-le en une phrase.""";

    static final String NO_SO_FAR = "- « jusquIci » : null.";

    /** The texts, the volume the reminder stops at, whether a model wrote them, and why they may be absent. */
    public record Story(String summary, String soFar, Integer upTo, boolean ai, String note) {
    }

    private final WorkReadModel works;
    private final EntityTypeRepository entityTypes;
    private final Map<String, Story> kept = new ConcurrentHashMap<>();
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:}")
    private String model;

    public WorkStoryService(WorkReadModel works, EntityTypeRepository entityTypes) {
        this.works = works;
        this.entityTypes = entityTypes;
    }

    public Story story(UUID entityId) {
        WorkView work = works.work(entityId);
        if (apiKey == null || apiKey.isBlank()) {
            return new Story(null, null, null, false, "Les résumés demandent une clé Gemini, absente ici.");
        }
        Integer upTo = lastOwnedVolume(work);
        String type = entityTypes.findById(work.entityTypeId()).map(EntityType::label).orElse("œuvre");
        String key = work.entityTypeId() + "|" + work.title().toLowerCase() + "|" + upTo;
        Story known = kept.get(key);
        if (known != null) {
            return known;
        }
        try {
            String soFar = upTo == null ? NO_SO_FAR : SO_FAR.formatted(upTo, upTo);
            HttpResponse<String> response = GeminiRequests.send(httpClient, objectMapper, apiKey, model,
                    PROMPT.formatted(work.title(), type, soFar));
            if (response.statusCode() != 200) {
                log.warn("Gemini ({}) answered {} to the story of '{}': {}", GeminiRequests.effectiveModel(model),
                        response.statusCode(), work.title(), GeminiRequests.snippet(response.body()));
                return new Story(null, null, null, false, "L'IA ne répond pas pour l'instant : réessaie plus tard.");
            }
            JsonNode answer = objectMapper.readTree(GeminiRequests.extractText(objectMapper, response.body()));
            String summary = clean(answer.path("resume").asText(""));
            if (!answer.path("connue").asBoolean(false) || summary.isEmpty()) {
                return new Story(null, null, null, true, "Pas de résumé fiable pour cette œuvre.");
            }
            String reminder = clean(answer.path("jusquIci").asText(""));
            Story story = new Story(summary, reminder.isEmpty() ? null : reminder,
                    reminder.isEmpty() ? null : upTo, true, null);
            if (kept.size() >= MAX_KEPT) {
                kept.clear();
            }
            kept.put(key, story);
            return story;
        } catch (Exception e) {
            log.warn("The story of '{}' failed: {}", work.title(), e.getMessage());
            return new Story(null, null, null, false, "L'IA ne répond pas pour l'instant : réessaie plus tard.");
        }
    }

    /** The highest numbered element owned, when the work has several numbered elements; null otherwise. */
    static Integer lastOwnedVolume(WorkView work) {
        long numbered = work.elements().stream().filter(c -> c.element().number() != null).count();
        if (numbered < 2) {
            return null;
        }
        return work.elements().stream().map(WorkView.CountedElement::element)
                .filter(element -> element.state() == WorkElement.State.OWNED && element.number() != null)
                .map(WorkElement::number).max(Integer::compare).orElse(null);
    }

    /** Plain text, one paragraph, bounded. */
    static String clean(String text) {
        if (text == null || text.equals("null")) {
            return "";
        }
        String plain = text.replaceAll("[*_`#]", "").replaceAll("\\s+", " ").trim();
        return plain.length() > MAX_TEXT ? plain.substring(0, MAX_TEXT - 1).trim() + "…" : plain;
    }
}
