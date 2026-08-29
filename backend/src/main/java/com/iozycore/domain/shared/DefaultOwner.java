package com.iozycore.domain.shared;

import java.util.UUID;

/**
 * Les deux identifiants de propriétaire qui ne désignent pas un compte comme
 * les autres.
 *
 * <h2>{@link #ID} — celui d'avant les comptes</h2>
 * Toutes les données saisies avant l'existence des comptes portent cet
 * identifiant : les colonnes {@code owner_id} existent depuis la migration V2,
 * remplies avec cette valeur « pour le jour où ». Ce jour est arrivé le
 * 2026-08-29, et la migration la plus délicate n'a pas eu lieu : le
 * <b>premier compte adopte cet identifiant</b> (voir {@code AppUser.premier}),
 * donc la collection existante devient la sienne sans qu'une seule ligne ne
 * bouge.
 *
 * <p>Il n'est plus utilisé à la création de quoi que ce soit : c'est la
 * session qui dit à qui appartient une écriture (voir
 * {@code ProprietaireCourant}).
 *
 * <h2>{@link #PERSONNE} — le propriétaire de rien</h2>
 * Le repli quand aucun compte n'est connu : hors requête authentifiée, ou sur
 * un chemin qui aurait oublié de dire au nom de qui il travaille. Aucun compte
 * ne peut le porter - les identifiants de comptes sont soit {@link #ID}, soit
 * tirés au hasard - donc <b>aucune ligne ne lui répond</b>.
 *
 * <p>C'est le point important : se tromper doit faire voir <b>rien</b>, jamais
 * la collection de quelqu'un d'autre. Un repli sur {@link #ID} aurait fait
 * exactement l'inverse, et sans bruit.
 */
public final class DefaultOwner {

    public static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    public static final UUID PERSONNE = UUID.fromString("ffffffff-ffff-ffff-ffff-ffffffffffff");

    private DefaultOwner() {
    }
}
