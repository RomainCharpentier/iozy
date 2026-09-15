package com.iozycore.manga.shelfimport;

import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.manga.recognition.ResolvedItem;

/**
 * Un tome lu sur l'étagère, avec ce que la collection en sait.
 *
 * @param resolved     la lecture, confrontée au catalogue - inchangée par rapport à
 *                     l'analyse d'annonce, l'écran doit pouvoir montrer la même chose
 * @param alreadyOwned un exemplaire de ce numéro est encore possédé, quelle que soit
 *                     l'édition : l'écran le montre coché et inerte, l'import l'ignore
 * @param proposal     la fiche que les sources proposent pour une série absente du
 *                     catalogue - {@code null} si la série est connue, si rien ne
 *                     correspond, ou si la recherche n'a pas été faite
 */
public record ShelfItem(ResolvedItem resolved, boolean alreadyOwned, MetadataCandidate proposal) {
}
