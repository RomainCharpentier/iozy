package com.iozycore.videogame.igdb;

import com.iozycore.core.insights.ReleaseDate;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;

/**
 * Les dates de sortie de jeux connus d'IGDB, par identifiant. Un jeu sans
 * date exploitable (« TBD », une année ou un trimestre seuls) répond vide ;
 * un jeu absent de la réponse, ou qu'une panne a empêché de lire, n'apparaît
 * pas dans la carte - c'est ce qui permet de ne jamais mettre en cache une
 * panne (voir IgdbReleaseDatesFetcher).
 */
public interface IgdbReleaseDates {

    Map<String, Optional<ReleaseDate>> fetch(Collection<String> igdbIds);
}
