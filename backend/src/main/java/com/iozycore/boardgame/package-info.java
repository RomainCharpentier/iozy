/**
 * Les jeux de société : BoardGameGeek pour la recherche, l'import d'une
 * collection, la hot list pour Découvrir. La racine porte les façades vers
 * le cœur, {@code bgg} la source, {@code api} l'import.
 *
 * <p>Un univers dépend du cœur, jamais l'inverse, jamais d'un autre univers
 * (Lot 133) - vérifié par le test des modules.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Jeux de société")
package com.iozycore.boardgame;
