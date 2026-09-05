package com.iozycore.core.insights;

import com.iozycore.core.domain.catalog.EntityType;

import java.util.List;

/**
 * Point d'extension du cœur : un univers propose ses découvertes.
 *
 * <p>Découvrir ne devine rien, il s'appuie sur un signal propre à chaque
 * type de collection - jeux similaires chez IGDB pour les jeux vidéo, même
 * auteur pour les mangas, catégories communes pour les jeux de société. Le
 * cœur ne connaît aucun de ces signaux : il demande à la source qui
 * {@link #supports couvre} le type (Lot 133 - un module par univers, le
 * cœur ne dépend d'aucun d'eux).
 */
public interface DiscoverySource {

    boolean supports(EntityType entityType);

    /** Les suggestions pour ce type - jamais ce qu'on possède déjà, jamais une panne déguisée en liste vide. */
    List<DiscoveryCandidate> discover(EntityType entityType);
}
