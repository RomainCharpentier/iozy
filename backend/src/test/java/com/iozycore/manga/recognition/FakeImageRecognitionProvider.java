package com.iozycore.manga.recognition;

import java.util.List;
import java.util.function.Supplier;

/**
 * Un moteur de reconnaissance <b>faux et déterministe</b>, seul moteur que les
 * tests connaissent.
 *
 * <p>Aucun test de ce dépôt n'appelle Gemini, OpenAI ni aucun modèle distant :
 * une suite qui dépend d'un service payant devient lente, instable et coûteuse,
 * et elle mesurerait la disponibilité d'un tiers plutôt que le code d'IozyCore.
 * Le vrai moteur est vérifié à la main, sur quelques photos, une fois.
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

    /** Un moteur qui lève - le service ne doit jamais laisser passer ça vers l'utilisateur. */
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
