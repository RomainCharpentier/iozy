package com.iozycore.manga.shelfimport;

import com.iozycore.manga.recognition.RecognitionStatus;

import java.util.List;

/**
 * Ce que l'écran de vérification reçoit après la lecture des photos.
 *
 * @param visionStatus       l'issue de la lecture des photos (voir {@link RecognitionStatus}) ;
 *                           jamais {@code null} ici, des photos ont toujours été envoyées
 * @param items              les tomes reconnus, confrontés au catalogue ET à la collection
 * @param unidentifiedCount  livres visibles mais non identifiés - à ajouter à la main
 * @param analyzedImageCount photos réellement lues
 * @param requestedImageCount photos envoyées, y compris celles écartées
 * @param lookupsSkipped     séries inconnues pour lesquelles aucune fiche n'a été cherchée,
 *                           faute de budget (voir {@code ShelfImportService.RECHERCHES_MAX})
 */
public record ShelfAnalysis(RecognitionStatus visionStatus, List<ShelfItem> items, int unidentifiedCount,
                            int analyzedImageCount, int requestedImageCount, int lookupsSkipped) {

    public ShelfAnalysis {
        items = items == null ? List.of() : List.copyOf(items);
    }
}
