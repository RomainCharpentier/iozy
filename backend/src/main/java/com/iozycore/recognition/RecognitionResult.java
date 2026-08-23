package com.iozycore.recognition;

import java.util.List;

/**
 * Ce qu'un moteur de reconnaissance rend pour un ensemble de photos.
 *
 * <h2>Une panne n'est pas une exception</h2>
 * Un moteur indisponible, une image illisible ou un résultat partiel sont des
 * <b>issues normales</b> du parcours, comme pour {@code ListingResolution} :
 * elles se distinguent par {@link #status()}, et le parcours manuel reprend la
 * main derrière. Rien ici ne doit jamais empêcher d'analyser une annonce à la
 * main.
 *
 * @param items            ce qui a été reconnu - vide est un résultat valide
 * @param unidentifiedCount nombre d'éléments visibles mais non identifiés ; l'écran doit
 *                          les montrer, sinon l'utilisateur croit que le lot est plus petit
 *                          qu'il n'est
 */
public record RecognitionResult(RecognitionStatus status, List<RecognizedItem> items, int unidentifiedCount) {

    public RecognitionResult {
        status = status == null ? RecognitionStatus.UNAVAILABLE : status;
        items = items == null ? List.of() : List.copyOf(items);
        unidentifiedCount = Math.max(0, unidentifiedCount);
    }

    public static RecognitionResult recognized(List<RecognizedItem> items, int unidentifiedCount) {
        // Rien de reconnu mais des éléments vus : c'est un résultat partiel, pas
        // un succès - l'écran doit le dire autrement.
        RecognitionStatus status = items == null || items.isEmpty()
                ? (unidentifiedCount > 0 ? RecognitionStatus.PARTIAL : RecognitionStatus.NOTHING_RECOGNIZED)
                : (unidentifiedCount > 0 ? RecognitionStatus.PARTIAL : RecognitionStatus.OK);
        return new RecognitionResult(status, items, unidentifiedCount);
    }

    /** Le moteur n'a pas pu répondre - panne, quota, délai dépassé. */
    public static RecognitionResult unavailable() {
        return new RecognitionResult(RecognitionStatus.UNAVAILABLE, List.of(), 0);
    }

    /** Aucun moteur n'est configuré : IozyCore fonctionne sans, l'écran le dit. */
    public static RecognitionResult noEngine() {
        return new RecognitionResult(RecognitionStatus.NO_ENGINE, List.of(), 0);
    }

    /** Aucune photo exploitable n'a pu être récupérée. */
    public static RecognitionResult noUsableImage() {
        return new RecognitionResult(RecognitionStatus.NO_USABLE_IMAGE, List.of(), 0);
    }

    public boolean hasItems() {
        return !items.isEmpty();
    }
}
