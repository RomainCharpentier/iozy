package com.iozycore.metadata;

/**
 * Un tome précis d'une édition française réelle d'une série (ex: "Tome 5"
 * de l'édition "Kana"), avec sa jaquette propre - distinct de
 * {@link MetadataCandidate} qui décrit la SÉRIE dans son ensemble (un seul
 * candidat par œuvre, pas un par tome). Résultat de
 * {@link VolumeSearchProvider#searchVolumes}, utilisé pour proposer une
 * sélection visuelle des tomes possédés (façon Mangacollec) plutôt que de
 * saisir un numéro de tome à l'aveugle.
 *
 * @param edition      nom de l'édition détecté (ex: "Kana", "Édition
 *                     originale") - jamais vide, replié sur l'éditeur brut
 *                     si aucun nom de collection n'a pu être isolé.
 * @param volumeNumber numéro de tome, tel qu'extrait du titre de la fiche.
 * @param imageUrl     jaquette de CE tome précis (peut différer de tome en
 *                     tome), ou null si la source n'en fournit pas.
 * @param title        titre brut de la fiche source, conservé pour du
 *                     débogage éventuel - jamais affiché tel quel.
 */
public record VolumeCandidate(String edition, int volumeNumber, String imageUrl, String title) {
}
