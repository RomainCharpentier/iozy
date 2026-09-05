package com.iozycore.manga.recognition;

/**
 * Ce que le catalogue IozyCore sait de ce qui vient d'être reconnu.
 *
 * <p>Cette question est <b>séparée</b> de la reconnaissance elle-même : lire
 * « Platinum End 4 » sur une photo et savoir si cette série existe dans le
 * catalogue sont deux choses. Les confondre ferait entrer une lecture
 * approximative dans le catalogue - or le catalogue reste la source de vérité,
 * et un résultat de moteur n'en est jamais une.
 */
public enum CatalogStatus {

    /** La série existe dans le catalogue, et l'édition lue y correspond. */
    MATCHED,

    /**
     * La série existe, mais l'édition n'a pas été lue ou ne correspond à aucune
     * édition connue. L'écran affiche « édition à confirmer » - il n'en choisit
     * jamais une, voir {@link RecognitionCatalogResolver}.
     */
    EDITION_TO_CONFIRM,

    /**
     * Reconnu, mais absent du catalogue local. Rien n'est créé : l'utilisateur
     * passera par le parcours catalogue habituel s'il le souhaite.
     */
    NOT_IN_CATALOG
}
