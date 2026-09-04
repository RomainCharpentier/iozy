package com.iozycore.insights.gemini;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.insights.AiCollectionOracle;
import com.iozycore.purchaseanalysis.gemini.GeminiRequests;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Pose la question a Gemini avec l'instantane en contexte - meme enveloppe,
 * meme cle et meme convention d'extinction que les deux conseillers de
 * l'Analyse d'achat ({@link GeminiRequests}). Le delai est plus long qu'une
 * suggestion d'edition : l'instantane peut peser plusieurs dizaines de
 * milliers de caracteres.
 */
@Component
public class GeminiCollectionOracle implements AiCollectionOracle {

    private static final Logger log = LoggerFactory.getLogger(GeminiCollectionOracle.class);

    private static final String PROMPT_TEMPLATE = """
            Tu aides une personne à explorer SA collection (mangas, jeux vidéo, jeux de société…). \
            Voici sa collection, en JSON - c'est ta SEULE source de vérité :
            %s

            Sa question : « %s »

            Réponds UNIQUEMENT avec un objet JSON (aucun texte autour) avec exactement ces clés :
            {
              "reponse": "<réponse en français, claire et directe, 3 à 8 phrases maximum, sans markdown ; \
            cite les titres tels quels ; donne les chiffres qui justifient la réponse>",
              "oeuvres": ["<id des œuvres de la collection sur lesquelles la réponse s'appuie, tels qu'ils \
            figurent dans le JSON - jamais un id inventé>"],
              "confiance": "<HIGH si les données répondent complètement, MEDIUM si partiellement, LOW si \
            elles ne permettent pas vraiment de répondre>"
            }
            Règles impératives : ne réponds qu'à partir des données ci-dessus - n'invente ni œuvre, ni date, \
            ni prix, ni note. Si les données ne permettent pas de répondre, dis-le simplement dans "reponse" \
            et mets "confiance" à LOW. Un "prixPayeTotalEuros" ne couvre que les exemplaires dont le prix \
            est connu ("prixConnusSur" le précise). "experiences" liste ce que la personne a lu, joué ou \
            abandonné, avec la date et parfois une note sur 10.""";

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:}")
    private String model;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public boolean estConfigure() {
        return apiKey != null && !apiKey.isBlank();
    }

    @Override
    public Optional<String> repondre(String instantane, String question) {
        if (!estConfigure()) {
            return Optional.empty();
        }
        try {
            HttpResponse<String> response = GeminiRequests.send(httpClient, objectMapper, apiKey, model,
                    PROMPT_TEMPLATE.formatted(instantane, question.replace("\"", "'")), List.of(),
                    Duration.ofSeconds(45));
            if (response.statusCode() != 200) {
                log.warn("Gemini ({}) a répondu {} à une question sur la collection : {}",
                        GeminiRequests.effectiveModel(model), response.statusCode(),
                        GeminiRequests.snippet(response.body()));
                return Optional.empty();
            }
            return Optional.ofNullable(GeminiRequests.extractText(objectMapper, response.body()));
        } catch (Exception e) {
            log.warn("Échec de l'appel à Gemini pour une question sur la collection : {}", e.getMessage());
            return Optional.empty();
        }
    }
}
