package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;

/**
 * Point d'extension du cœur : un univers sait quand sortent les œuvres qu'on
 * possède ou qu'on veut.
 *
 * <p>Le cœur ne connaît aucune source de dates : Google Books pour les tomes
 * d'un manga, IGDB pour un jeu vidéo. Il demande à l'univers qui
 * {@link #supports couvre} la catégorie, en lui donnant ce qu'il a déjà lu
 * (les œuvres possédées ou voulues, leurs possessions, leurs envies - voir
 * {@link ReleaseContext}) pour qu'aucune source ne relise le catalogue de
 * son côté. Une catégorie que personne ne couvre n'a que les dates saisies à
 * la main sur ses fiches, et c'est le type qui le dit au client
 * ({@code hasReleaseSource}), jamais une liste de codes dans un écran.
 */
public interface ReleaseSource {

    boolean supports(EntityType entityType);

    /**
     * Les sorties de la période pour les œuvres du contexte - jamais une date
     * inventée, jamais une panne déguisée en liste vide silencieuse : une
     * source qui ne sait pas rend simplement ce qu'elle sait.
     */
    List<ReleaseEntry> releasesBetween(ReleaseContext context);
}
