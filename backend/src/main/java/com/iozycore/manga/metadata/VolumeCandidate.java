package com.iozycore.manga.metadata;

import com.iozycore.core.domain.shared.TexteRecherche;

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
 * @param isbn         ISBN de CE tome, chiffres seuls, ou null - c'est lui qui
 *                     distingue deux éditions d'un même éditeur portant le
 *                     même numéro de tome (voir
 *                     {@code TomeSearchService.separerLesEditionsHomonymes}).
 * @param annee        année de publication, ou null - sert à NOMMER une édition
 *                     ainsi séparée, jamais à décider de la séparation.
 */
public record VolumeCandidate(String edition, int volumeNumber, String imageUrl, String title,
                               String isbn, Integer annee) {

    /**
     * Les deux champs d'identification d'édition sont facultatifs : ce
     * constructeur laisse intacts les appelants (et les tests) qui n'en ont
     * pas - même procédé que {@code PurchaseAnalysisEngine.ItemContext} au
     * Lot Phase 2, pour ajouter un champ à un record sans toucher ses
     * dizaines de sites d'appel.
     */
    public VolumeCandidate(String edition, int volumeNumber, String imageUrl, String title) {
        this(edition, volumeNumber, imageUrl, title, null, null);
    }

    /** Les chiffres de l'ISBN, sans tirets ni espaces - null si absent ou vide. */
    public String isbnNormalise() {
        if (isbn == null) {
            return null;
        }
        String chiffres = isbn.replaceAll("[^0-9Xx]", "");
        return chiffres.isBlank() ? null : chiffres.toUpperCase();
    }

    /**
     * L'identité d'un tome dans une série : (édition, numéro), à la casse et
     * aux espaces près. Une série a un tome 1 PAR édition - le numéro seul
     * n'identifie rien.
     *
     * <p>Statique et prenant ses deux morceaux séparément parce que les deux
     * appelants ne partent pas du même objet : {@link TomeSearchService}
     * dédoublonne des candidats, {@code MetadataController} compare un Variant
     * déjà catalogué à ces candidats pour dire « déjà possédé ». Chacun en
     * avait sa copie.
     */
    public static String key(String edition, int volumeNumber) {
        // Accents et ponctuation plies aussi (Lot 125) : la BnF ecrit
        // « Kazé », Google Books « KAZE », et c'etait deux editions.
        return TexteRecherche.normaliser(edition) + "|" + volumeNumber;
    }

    public String key() {
        return key(edition, volumeNumber);
    }
}
