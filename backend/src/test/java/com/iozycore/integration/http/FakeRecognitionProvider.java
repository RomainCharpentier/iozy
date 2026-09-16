package com.iozycore.integration.http;

import com.iozycore.manga.recognition.ImageRecognitionProvider;
import com.iozycore.manga.recognition.RecognitionConfidence;
import com.iozycore.manga.recognition.RecognitionContext;
import com.iozycore.manga.recognition.RecognitionImage;
import com.iozycore.manga.recognition.RecognitionImageFetcher;
import com.iozycore.manga.recognition.RecognitionResult;
import com.iozycore.manga.recognition.RecognizedItem;
import com.iozycore.core.listing.ListingProvider;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Un moteur de reconnaissance faux, et un fetcher qui ne va nulle part.
 *
 * <h2>Zéro appel réseau, zéro appel IA</h2>
 * Aucun test de ce dépôt n'appelle Gemini ni aucun modèle distant, et aucun ne
 * télécharge d'image. Le moteur réel ({@code GeminiVisionRecognitionProvider})
 * est de toute façon inerte sans clé d'API - mais on ne s'en remet pas à ça :
 * ce faux est {@code @Primary}, il passe donc devant lui quoi qu'il arrive.
 *
 * <h2>Le comportement se pilote par l'URL demandée</h2>
 * Plutôt que de reconfigurer un bean entre deux tests - ce qui créerait un état
 * partagé - chaque scénario se déclenche par ce que le test demande. La même
 * instance sert tous les cas.
 */
@TestConfiguration
public class FakeRecognitionProvider {

    /** L'hôte que le faux fetcher accepte de « joindre » - il ne joint rien en réalité. */
    public static final String HOTE_PHOTOS = "photos-de-test.invalid";

    public static final String DECLENCHE_PANNE = "moteur-en-panne";
    public static final String DECLENCHE_RIEN = "rien-de-lisible";
    public static final String DECLENCHE_PARTIEL = "partiel";
    public static final String DECLENCHE_DOUBLON = "doublon";
    public static final String DECLENCHE_HORS_CATALOGUE = "hors-catalogue";
    public static final String DECLENCHE_EDITION_INCONNUE = "edition-inconnue";
    public static final String DECLENCHE_QUOTA = "quota-epuise";

    /**
     * Combien de fois un moteur de vision a réellement été sollicité.
     * <p>
     * Statique et partagé : c'est ce qui permet d'affirmer, depuis un test
     * HTTP, qu'analyser du texte n'a déclenché <b>aucun</b> appel de moteur -
     * l'invariant central de la V2, et celui qui coûte de l'argent quand il
     * est violé.
     */
    private static final java.util.concurrent.atomic.AtomicInteger APPELS =
            new java.util.concurrent.atomic.AtomicInteger();

    public static int appelsAuMoteur() {
        return APPELS.get();
    }

    public static String photo(String declencheur, int index) {
        return "https://" + HOTE_PHOTOS + "/" + declencheur + "/" + index + ".jpg";
    }

    /**
     * Remplace le vrai fetcher : il rend une image factice par URL portant
     * l'hôte de test, et rien pour les autres. Aucune socket n'est ouverte.
     */
    @Bean
    @Primary
    RecognitionImageFetcher fauxFetcher(List<ListingProvider> providers) {
        return new RecognitionImageFetcher(providers) {
            @Override
            public List<RecognitionImage> fetch(List<String> imageUrls) {
                List<RecognitionImage> images = new ArrayList<>();
                if (imageUrls == null) {
                    return images;
                }
                for (String url : imageUrls) {
                    if (url != null && url.startsWith("https://" + HOTE_PHOTOS + "/")) {
                        images.add(new RecognitionImage(images.size(), url,
                                new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF}, "image/jpeg"));
                    }
                }
                return images;
            }
        };
    }

    /**
     * Ce qui pilote la réponse du faux moteur.
     *
     * <p>Une photo <b>récupérée</b> d'une annonce porte son URL, et le mot-clé y
     * est écrit. Une photo <b>envoyée</b> par l'utilisateur n'a pas d'adresse -
     * c'est justement le point de cette porte - donc le mot-clé est alors lu
     * dans ses octets. Sans ce repli, le faux moteur lèverait un NPE sur tout
     * envoi direct : une supposition de test qui ne tient plus.
     */
    private static String declencheurDe(RecognitionImage image) {
        return image.sourceUrl() != null
                ? image.sourceUrl()
                : new String(image.bytes(), java.nio.charset.StandardCharsets.ISO_8859_1);
    }

    @Bean
    @Primary
    ImageRecognitionProvider fauxMoteurDeReconnaissance() {
        return new ImageRecognitionProvider() {
            @Override
            public boolean isAvailable() {
                return true;
            }

            @Override
            public String name() {
                return "FAKE_HTTP";
            }

            @Override
            public RecognitionResult recognize(List<RecognitionImage> images, RecognitionContext context) {
                APPELS.incrementAndGet();
                String declencheur = images.isEmpty() ? "" : declencheurDe(images.get(0));

                if (declencheur.contains(DECLENCHE_PANNE)) {
                    return RecognitionResult.unavailable();
                }
                if (declencheur.contains(DECLENCHE_QUOTA)) {
                    return RecognitionResult.quotaExceeded();
                }
                if (declencheur.contains(DECLENCHE_RIEN)) {
                    return RecognitionResult.recognized(List.of(), 0);
                }
                if (declencheur.contains(DECLENCHE_PARTIEL)) {
                    return RecognitionResult.recognized(List.of(
                            item("Platinum End", 1, "Standard", RecognitionConfidence.HIGH, Set.of(0))), 3);
                }
                if (declencheur.contains(DECLENCHE_DOUBLON)) {
                    // Le même tome vu sur trois photos - doit ressortir une fois.
                    return RecognitionResult.recognized(List.of(
                            item("Platinum End", 4, "Standard", RecognitionConfidence.MEDIUM, Set.of(0)),
                            item("Platinum End", 4, "Standard", RecognitionConfidence.HIGH, Set.of(1)),
                            item("Platinum End", 4, "Standard", RecognitionConfidence.LOW, Set.of(2))), 0);
                }
                if (declencheur.contains(DECLENCHE_HORS_CATALOGUE)) {
                    return RecognitionResult.recognized(List.of(
                            item("Série absolument inconnue " + java.util.UUID.randomUUID(), 2, null,
                                    RecognitionConfidence.HIGH, Set.of(0))), 0);
                }
                if (declencheur.contains(DECLENCHE_EDITION_INCONNUE)) {
                    return RecognitionResult.recognized(List.of(
                            item("Death Note", 1, null, RecognitionConfidence.HIGH, Set.of(0))), 0);
                }
                return RecognitionResult.recognized(List.of(
                        item("Platinum End", 1, "Standard", RecognitionConfidence.HIGH, Set.of(0)),
                        item("Platinum End", 2, "Standard", RecognitionConfidence.MEDIUM, Set.of(0))), 0);
            }

            private RecognizedItem item(String titre, Integer tome, String edition,
                                         RecognitionConfidence confiance, Set<Integer> photos) {
                // Un cadre par élément, sur la première photo où il est vu :
                // l'écran de vérification doit pouvoir le dessiner.
                int photo = photos.isEmpty() ? 0 : photos.iterator().next();
                return RecognizedItem.fromVision(titre, tome, edition, null, confiance,
                        List.of("lecture de test"), photos,
                        List.of(new com.iozycore.manga.recognition.RecognizedBox(photo, 0.1, 0.2, 0.9, 0.3)));
            }
        };
    }
}
