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
 * Lit les photos avec Gemini (ai.google.dev), en multimodal.
 *
 * <h2>Désactivé sans clé</h2>
 * Même convention que {@code GeminiEditionAdvisor} : clé absente, le moteur se
 * déclare indisponible et n'appelle jamais. Ce n'est pas une erreur, c'est
 * IozyCore sans reconnaissance - la saisie manuelle reste entière.
 *
 * <h2>Les images quittent la machine</h2>
 * À dire clairement, parce que c'est vrai : les photos analysées sont envoyées
 * à Google. C'est la raison pour laquelle rien n'est déclenché automatiquement
 * (l'utilisateur clique « Analyser les photos »), pour laquelle le nombre
 * d'images est plafonné, et pour laquelle aucun octet d'image n'apparaît dans
 * les journaux.
 *
 * <h2>Le prompt ne contient AUCUN texte d'annonce</h2>
 * Rien de ce que le vendeur a écrit n'entre ici : ni titre, ni description.
 * C'est à la fois une protection - un texte écrit par un tiers et concaténé
 * dans un prompt peut en détourner les consignes - et une exigence de
 * méthode : un modèle à qui l'on annonce « lot de 14 tomes de Platinum End »
 * rendra volontiers quatorze tomes de Platinum End, qu'ils soient sur les
 * photos ou non. Le texte est lu ailleurs, localement, par
 * {@code ListingTextRecognizer} ; ce moteur ne répond qu'à « que voit-on sur
 * ces images ? ».
 * <p>
 * Les seules entrées de ce provider sont donc des <b>octets d'image</b> et un
 * code d'univers.
 */
@Component
public class GeminiVisionRecognitionProvider implements ImageRecognitionProvider {

    private static final Logger log = LoggerFactory.getLogger(GeminiVisionRecognitionProvider.class);

    /** Plusieurs mégaoctets d'images à téléverser : un délai de texte ne suffit pas. */
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
        // La V1 n'est validée que sur le manga : le moteur décline poliment le
        // reste plutôt que de rendre des réponses invérifiées sur un jeu de
        // société ou un jeu vidéo.
        if (context != null && context.expectedEntityTypeCode() != null && !context.isManga()) {
            return RecognitionResult.noEngine();
        }

        try {
            List<GeminiRequests.InlineImage> jointes = images.stream()
                    .map(image -> new GeminiRequests.InlineImage(image.mediaType(), image.bytes()))
                    .toList();

            HttpResponse<String> response = GeminiRequests.send(httpClient, objectMapper, apiKey, model,
                    PROMPT.formatted(images.size()), jointes, TIMEOUT);

            if (response.statusCode() != 200) {
                log.warn("Gemini vision ({}) a répondu {} pour {} photo(s) : {}",
                        GeminiRequests.effectiveModel(model), response.statusCode(), images.size(),
                        GeminiRequests.snippet(response.body()));
                // Un 429 qui subsiste après les reprises de GeminiRequests n'est
                // plus un pic de charge : c'est le quota. Réessayer tout de suite
                // ne servirait à rien, et l'écran doit dire autre chose.
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
            // Jamais le corps de la requête dans les journaux : il contient les
            // images en base64.
            log.warn("Gemini vision indisponible : {}", e.getClass().getSimpleName());
            return RecognitionResult.unavailable();
        }
    }

    /** Package-private et statique : la lecture du JSON se teste sans réseau. */
    static RecognitionResult parse(ObjectMapper objectMapper, String json) throws Exception {
        JsonNode root = objectMapper.readTree(json);
        List<RecognizedItem> items = new ArrayList<>();

        for (JsonNode node : root.path("items")) {
            String titre = texte(node, "seriesTitle");
            if (titre == null) {
                // Sans titre lu, ce n'est pas un élément : le compter comme
                // identifié gonflerait le lot d'une ligne vide.
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
     * Un EAN a 13 chiffres (ou 10 pour un vieil ISBN). Tout le reste est une
     * hallucination de chiffres : la laisser passer donnerait à cet élément la
     * priorité « identifiant exact » qu'il ne mérite pas.
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
        // Une valeur inattendue devient LOW, jamais HIGH : dans le doute sur ce
        // que le modèle a voulu dire, on ne pré-coche pas.
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
     * Le cadre du livre, si le modèle a su le situer : {@code box_2d} en
     * millièmes, sur la photo {@code boxImage} - à défaut la première des
     * photos où il dit l'avoir vu. Quatre nombres ou rien : un tableau
     * incomplet, un texte, un rectangle sans surface ne donnent pas de cadre,
     * et la lecture reste entière sans lui.
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
