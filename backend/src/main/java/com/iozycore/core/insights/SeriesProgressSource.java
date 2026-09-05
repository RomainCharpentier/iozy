package com.iozycore.core.insights;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Point d'extension du cœur : la progression « X tomes possédés sur Y » d'une
 * œuvre, telle qu'un univers sait la calculer - pour un manga, à partir de
 * ses éditions de référence (Lot 133). Le cœur l'affiche (fiche, partage,
 * statistiques, question IA) sans savoir d'où viennent les totaux.
 */
public interface SeriesProgressSource {

    List<CollectionProgress> computeAll();

    Optional<CollectionProgress> compute(UUID entityId);
}
