package com.iozycore.manga.recognition;

import java.util.Optional;

/**
 * Ce qu'un code-barres désigne — vu depuis la reconnaissance.
 *
 * <h2>Pourquoi une interface pour une seule méthode</h2>
 * {@link BarcodeImageDecoder} lit un EAN <b>sans rien appeler</b>. Savoir de
 * quel livre il s'agit, en revanche, demande de sortir : une base
 * bibliographique, donc du réseau, donc une panne possible et une latence.
 *
 * <p>Séparer les deux garde cette frontière visible. Le décodage reste gratuit,
 * déterministe et toujours disponible ; la résolution est une dépendance
 * externe que les tests remplacent, et dont l'échec ne doit jamais coûter plus
 * qu'un code-barres non identifié.
 *
 * <h2>Un titre, pas une fiche</h2>
 * La méthode ne rend qu'un <b>titre</b>, délibérément. Les sources
 * bibliographiques ne donnent pas de numéro de tome structuré — elles écrivent
 * « Naruto, Vol. 9 » dans un champ texte. Ce titre est ensuite lu par les
 * mêmes règles que le titre d'une annonce ({@code ListingTextParser}), plutôt
 * que par une seconde extraction qui divergerait de la première.
 */
public interface BarcodeWorkLookup {

    /**
     * @param ean             le code lu sur une photo, déjà validé par sa clé de contrôle
     * @param entityTypeCode  l'univers attendu (« MANGA »), ou {@code null}
     * @return le titre du tirage désigné, ou vide — <b>vide est un résultat
     *         normal</b> : un EAN peut être absent des bases, et un livre non
     *         identifié n'empêche pas le reste du lot d'être lu
     */
    Optional<String> titleFor(String ean, String entityTypeCode);
}
