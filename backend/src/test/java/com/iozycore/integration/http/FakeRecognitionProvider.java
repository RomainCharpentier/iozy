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
 * A fake recognition engine, and a fetcher that goes nowhere.
 *
 * <h2>Zero network call, zero AI call</h2>
 * No test of this repository calls Gemini or any remote model, and none
 * downloads an image. The real engine ({@code GeminiVisionRecognitionProvider})
 * is inert anyway without an API key - but we do not rely on that:
 * this fake is {@code @Primary}, so it goes in front of it whatever happens.
 *
 * <h2>The behaviour is driven by the requested URL</h2>
 * Rather than reconfiguring a bean between two tests - which would create a
 * shared state - each scenario is triggered by what the test asks. The same
 * instance serves all the cases.
 */
@TestConfiguration
public class FakeRecognitionProvider {

    /** The host that the fake fetcher agrees to "reach" - it reaches nothing in reality. */
    public static final String HOTE_PHOTOS = "photos-de-test.invalid";

    public static final String DECLENCHE_PANNE = "moteur-en-panne";
    public static final String DECLENCHE_RIEN = "rien-de-lisible";
    public static final String DECLENCHE_PARTIEL = "partiel";
    public static final String DECLENCHE_DOUBLON = "doublon";
    public static final String DECLENCHE_HORS_CATALOGUE = "hors-catalogue";
    public static final String DECLENCHE_EDITION_INCONNUE = "edition-inconnue";
    public static final String DECLENCHE_QUOTA = "quota-epuise";

    /**
     * How many times a vision engine was really called.
     * <p>
     * Static and shared: this is what allows to state, from an HTTP
     * test, that analysing text triggered <b>no</b> engine call -
     * the central invariant of V2, and the one that costs money when it
     * is broken.
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
     * Replaces the real fetcher: it returns a fake image for each URL carrying
     * the test host, and nothing for the others. No socket is opened.
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
     * What drives the answer of the fake engine.
     *
     * <p>A photo <b>fetched</b> from a listing carries its URL, and the keyword
     * is written in it. A photo <b>sent</b> by the user has no address -
     * this is precisely the point of this door - so the keyword is then read
     * in its bytes. Without this fallback, the fake engine would throw an NPE on any
     * direct upload: a test assumption that no longer holds.
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
                    // The same volume seen on three photos - must come out once.
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
                // One frame per item, on the first photo where it is seen:
                // the check screen must be able to draw it.
                int photo = photos.isEmpty() ? 0 : photos.iterator().next();
                return RecognizedItem.fromVision(titre, tome, edition, null, confiance,
                        List.of("lecture de test"), photos,
                        List.of(new com.iozycore.manga.recognition.RecognizedBox(photo, 0.1, 0.2, 0.9, 0.3)));
            }
        };
    }
}
