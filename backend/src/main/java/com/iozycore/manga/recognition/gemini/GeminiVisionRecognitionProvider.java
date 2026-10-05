package com.iozycore.manga.recognition.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.core.gemini.GeminiRequests;
import com.iozycore.manga.recognition.ImageRecognitionProvider;
import com.iozycore.manga.recognition.RecognitionConfidence;
import com.iozycore.manga.recognition.RecognitionContext;
import com.iozycore.manga.recognition.RecognitionImage;
import com.iozycore.manga.recognition.RecognitionResult;
import com.iozycore.manga.recognition.RecognizedItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Reads the photos with Gemini (ai.google.dev), in multimodal mode.
 *
 * <h2>Disabled without a key</h2>
 * Same convention as {@code GeminiEditionAdvisor}: key missing, the engine
 * declares itself unavailable and never calls. This is not an error, it is
 * IozyCore without recognition - manual entry stays whole.
 *
 * <h2>The images leave the machine</h2>
 * To be said clearly, because it is true: the analysed photos are sent
 * to Google. This is the reason why nothing is triggered automatically
 * (the user clicks "Analyser les photos"), why the number
 * of images is capped, and why no image byte appears in
 * the logs.
 *
 * <h2>The prompt contains NO listing text</h2>
 * Nothing that the seller wrote enters here: neither title nor description.
 * This is both a protection - a text written by a third party and concatenated
 * into a prompt can hijack its instructions - and a requirement of
 * method: a model to which we announce "lot de 14 tomes de Platinum End"
 * will gladly return fourteen volumes of Platinum End, whether they are on the
 * photos or not. The text is read elsewhere, locally, by
 * {@code ListingTextRecognizer}; this engine only answers "what do we see on
 * these images?".
 * <p>
 * The only inputs of this provider are therefore <b>image bytes</b> and a
 * universe code.
 */
@Component
public class GeminiVisionRecognitionProvider implements ImageRecognitionProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiVisionRecognitionProvider.class);

    /** Several megabytes of images to upload: a text timeout is not enough. */
    private static final Duration TIMEOUT = Duration.ofSeconds(45);

    private static final String PROMPT = """
            Tu regardes %d photo(s) d'une annonce de mangas d'occasion, dans l'ordre où elles te sont données \
            (photo 0 en premier).

            Ta seule tâche : lister les tomes RÉELLEMENT VISIBLES sur ces photos.

            Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
            {
              "items": [
                {
                  "seriesTitle": "<titre de la série tel que tu le LIS sur la couverture ou la tranche>",
                  "volumeNumber": <numéro de tome visible, entier, ou null si tu ne le vois pas>,
                  "editionHint": "<mention d'édition visible (Perfect, Deluxe, Intégrale...), ou null>",
                  "ean": "<code EAN/ISBN si tu lis distinctement ses chiffres, sinon null>",
                  "confidence": "<HIGH, MEDIUM ou LOW>",
                  "evidence": "<en 6 mots maximum, ce que tu vois qui justifie ta réponse>",
                  "sourceImages": [<index des photos où tu le vois>],
                  "boxImage": <index de la photo où tu le vois le mieux>,
                  "box_2d": [<ymin>, <xmin>, <ymax>, <xmax>]
                }
              ],
              "unidentifiedCount": <nombre de livres visibles que tu n'arrives PAS à identifier>
            }

            Règles impératives :
            - N'invente RIEN. Un livre dont tu ne lis pas le titre va dans unidentifiedCount, pas dans items.
            - Ne complète JAMAIS une série. Si tu vois les tomes 1, 2 et 5, réponds 1, 2 et 5 - jamais 3 et 4.
            - Si le même tome apparaît sur plusieurs photos, mets-le UNE fois avec tous ses index dans sourceImages.
            - volumeNumber null est une bonne réponse quand le numéro n'est pas lisible. Ne le devine pas.
            - editionHint null est une bonne réponse. Ne choisis pas une édition parce qu'elle est courante.
            - confidence HIGH seulement si titre ET numéro sont nettement lisibles.
            - box_2d : le rectangle qui entoure CE livre sur la photo boxImage, en millièmes de sa hauteur et de \
            sa largeur (0 à 1000), dans l'ordre [ymin, xmin, ymax, xmax]. Serré sur le livre lui-même : ni son \
            voisin, ni la rangée entière. Si tu ne sais pas le situer, mets box_2d à null.
            - Rien ne t'est dit du contenu attendu : décris uniquement ce que tu vois.""";

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:}")
    private String model;

    /** The model that takes over when the main one is saturated - see GeminiRequests.avecRepli. */
    @Value("${gemini.fallback-model:}")
    private String fallbackModel;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public String name() {
        return "GEMINI_VISION";
    }

    @Override
    public RecognitionResult recognize(List<RecognitionImage> images, RecognitionContext context) {
        if (!isAvailable() || images == null || images.isEmpty()) {
            return RecognitionResult.unavailable();
        }
        // V1 is only validated on manga: the engine politely declines the
        // rest rather than returning unverified answers on a board
        // game or a video game.
        if (context != null && context.expectedEntityTypeCode() != null && !context.isManga()) {
            return RecognitionResult.noEngine();
        }

        try {
            List<GeminiRequests.InlineImage> jointes = images.stream()
                    .map(image -> new GeminiRequests.InlineImage(image.mediaType(), image.bytes()))
                    .toList();

            HttpResponse<String> response = GeminiRequests.send(httpClient, objectMapper, apiKey, model, fallbackModel,
                    PROMPT.formatted(images.size()), jointes, TIMEOUT);

            if (response.statusCode() != 200) {
                log.warn("Gemini vision ({}) answered {} for {} photo(s): {}",
                        GeminiRequests.effectiveModel(model), response.statusCode(), images.size(),
                        GeminiRequests.snippet(response.body()));
                // A 429 that remains after the retries of GeminiRequests is no
                // longer a load spike: it is the quota. Trying again right away
                // would be useless, and the screen must say something else.
                return response.statusCode() == 429
                        ? RecognitionResult.quotaExceeded()
                        : RecognitionResult.unavailable();
            }

            String json = GeminiRequests.extractText(objectMapper, response.body());
            return json == null ? RecognitionResult.unavailable() : parse(objectMapper, json);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return RecognitionResult.unavailable();
        } catch (Exception e) {
            // Never the body of the request in the logs: it contains the
            // images in base64.
            log.warn("Gemini vision unavailable: {}", e.getClass().getSimpleName());
            return RecognitionResult.unavailable();
        }
    }

    /** Package-private and static: reading the JSON can be tested without a network. */
    static RecognitionResult parse(ObjectMapper objectMapper, String json) throws Exception {
        JsonNode root = objectMapper.readTree(json);
        List<RecognizedItem> items = new ArrayList<>();

        for (JsonNode node : root.path("items")) {
            String titre = texte(node, "seriesTitle");
            if (titre == null) {
                // Without a title read, it is not an item: counting it as
                // identified would inflate the batch with an empty line.
                continue;
            }
            Set<Integer> photos = indexPhotos(node);
            items.add(RecognizedItem.fromVision(
                    titre,
                    entier(node, "volumeNumber"),
                    texte(node, "editionHint"),
                    eanValide(texte(node, "ean")),
                    confiance(texte(node, "confidence")),
                    evidence(node),
                    photos,
                    boites(node, photos)));
        }

        int nonIdentifies = Math.max(0, root.path("unidentifiedCount").asInt(0));
        return RecognitionResult.recognized(items, nonIdentifies);
    }

    /**
     * An EAN has 13 digits (or 10 for an old ISBN). Everything else is a
     * digit hallucination: letting it through would give this item the
     * "exact identifier" priority that it does not deserve.
     */
    private static String eanValide(String brut) {
        if (brut == null) {
            return null;
        }
        String chiffres = brut.replaceAll("[^0-9]", "");
        return chiffres.length() == 13 || chiffres.length() == 10 ? chiffres : null;
    }

    private static final Set<String> NIVEAUX = Set.of("HIGH", "MEDIUM", "LOW");

    private static RecognitionConfidence confiance(String brut) {
        if (brut == null) {
            return RecognitionConfidence.LOW;
        }
        String normalise = brut.trim().toUpperCase(Locale.ROOT);
        // An unexpected value becomes LOW, never HIGH: when in doubt about what
        // the model meant, we do not pre-tick.
        return NIVEAUX.contains(normalise) ? RecognitionConfidence.valueOf(normalise) : RecognitionConfidence.LOW;
    }

    private static List<String> evidence(JsonNode node) {
        String raison = texte(node, "evidence");
        return raison == null ? List.of() : List.of(raison);
    }

    private static Set<Integer> indexPhotos(JsonNode node) {
        Set<Integer> index = new java.util.TreeSet<>();
        for (JsonNode valeur : node.path("sourceImages")) {
            if (valeur.isInt() && valeur.asInt() >= 0) {
                index.add(valeur.asInt());
            }
        }
        return index;
    }

    /**
     * The frame of the book, if the model could place it: {@code box_2d} in
     * thousandths, on the photo {@code boxImage} - failing that the first of the
     * photos where it says it saw it. Four numbers or nothing: an incomplete
     * array, a text, a rectangle with no area do not give a frame,
     * and the reading stays whole without it.
     */
    private static List<com.iozycore.manga.recognition.RecognizedBox> boites(JsonNode node, Set<Integer> photos) {
        JsonNode boite = node.path("box_2d");
        if (!boite.isArray() || boite.size() != 4) {
            return List.of();
        }
        for (JsonNode valeur : boite) {
            if (!valeur.isNumber()) {
                return List.of();
            }
        }
        Integer image = entier(node, "boxImage");
        if (image == null || image < 0) {
            image = photos.isEmpty() ? 0 : photos.iterator().next();
        }
        return com.iozycore.manga.recognition.RecognizedBox
                .fromThousandths(image, boite.get(0).asDouble(), boite.get(1).asDouble(), boite.get(2).asDouble(),
                        boite.get(3).asDouble())
                .map(List::of)
                .orElse(List.of());
    }

    private static String texte(JsonNode node, String champ) {
        JsonNode valeur = node.path(champ);
        if (valeur.isMissingNode() || valeur.isNull()) {
            return null;
        }
        String brut = valeur.asText(null);
        return brut == null || brut.isBlank() || "null".equalsIgnoreCase(brut.trim()) ? null : brut.trim();
    }

    private static Integer entier(JsonNode node, String champ) {
        JsonNode valeur = node.path(champ);
        return valeur.isInt() ? valeur.asInt() : null;
    }
}
