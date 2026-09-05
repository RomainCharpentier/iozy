/**
 * Le CŒUR : ce qui vaut pour tous les types de collection - le catalogue
 * générique (œuvres, tomes, types), les possessions, les envies, les tier
 * lists, les comptes, le partage, l'export, les statistiques, les annonces,
 * et les points d'extension que les univers implémentent (fournisseur de
 * métadonnées, code-barres, découverte, progression, valeur, jaquette,
 * édition rattachée, suppression, export).
 *
 * <p>Module OUVERT : les univers ({@code manga}, {@code videogame},
 * {@code boardgame}, {@code custom}) s'appuient sur son domaine, ses cas
 * d'usage et ses contrats. Lui ne connaît aucun univers - c'est ce que le
 * test des modules vérifie, et ce qui permet d'en sortir un en service plus
 * tard (Lot 133).
 */
@org.springframework.modulith.ApplicationModule(displayName = "Cœur", type = org.springframework.modulith.ApplicationModule.Type.OPEN)
package com.iozycore.core;
