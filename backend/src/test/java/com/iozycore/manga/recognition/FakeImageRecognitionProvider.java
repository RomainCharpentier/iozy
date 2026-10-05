package com.iozycore.manga.recognition;

import java.util.List;
import java.util.function.Supplier;

/**
 * A <b>fake and deterministic</b> recognition engine, the only engine the
 * tests know.
 *
 * <p>No test of this repository calls Gemini, OpenAI or any remote model:
 * a suite that depends on a paid service becomes slow, unstable and costly,
 * and it would measure the availability of a third party rather than the IozyCore code.
 * The real engine is checked by hand, on a few photos, once.
 */
public class FakeImageRecognitionProvider implements ImageRecognitionProvider {

    private final Supplier<RecognitionResult> reponse;
    private boolean available = true;
    private int appels;
    private List<RecognitionImage> dernieresImages = List.of();
    private RecognitionContext dernierContexte;

    public FakeImageRecognitionProvider(Supplier<RecognitionResult> reponse) {
        this.reponse = reponse;
    }

    public static FakeImageRecognitionProvider rendant(RecognitionResult resultat) {
        return new FakeImageRecognitionProvider(() -> resultat);
    }

    /** An engine that throws - the service must never let that through to the user. */
    public static FakeImageRecognitionProvider quiExplose() {
        return new FakeImageRecognitionProvider(() -> {
            throw new IllegalStateException("moteur de test en panne");
        });
    }

    public FakeImageRecognitionProvider indisponible() {
        this.available = false;
        return this;
    }

    @Override
    public boolean isAvailable() {
        return available;
    }

    @Override
    public RecognitionResult recognize(List<RecognitionImage> images, RecognitionContext context) {
        appels++;
        dernieresImages = images == null ? List.of() : List.copyOf(images);
        dernierContexte = context;
        return reponse.get();
    }

    @Override
    public String name() {
        return "FAKE";
    }

    public int appels() {
        return appels;
    }

    public List<RecognitionImage> dernieresImages() {
        return dernieresImages;
    }

    public RecognitionContext dernierContexte() {
        return dernierContexte;
    }
}
