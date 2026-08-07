package com.iozycore.metadata;

import com.iozycore.domain.catalog.EntityType;

import java.util.List;

/**
 * Recherche les tomes réels (avec jaquette) des différentes éditions
 * françaises d'une série - voir {@link VolumeCandidate}. Distinct de
 * {@link FrenchTitleProvider} (qui ne renvoie qu'un titre) : ici on veut
 * de quoi construire une sélection visuelle des tomes possédés.
 */
public interface VolumeSearchProvider {

    boolean supports(EntityType entityType);

    /** Best-effort : une liste vide signifie "rien trouvé", jamais une erreur -
     * l'appelant garde alors le parcours de saisie manuelle du tome. */
    List<VolumeCandidate> searchVolumes(String seriesTitle, String author);
}
