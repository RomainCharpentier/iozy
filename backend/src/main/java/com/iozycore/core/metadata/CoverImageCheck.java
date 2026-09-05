package com.iozycore.core.metadata;

/**
 * Point d'extension du cœur : une jaquette peut-elle être GARDÉE ?
 *
 * <p>Le cœur enregistre l'adresse d'une jaquette telle qu'un fournisseur la
 * donne ; certains fournisseurs répondent 200 sur une adresse qui n'a pas
 * d'image (la BnF, en 500). Un univers qui connaît ce genre de source dit
 * ici si l'adresse est utilisable - le cœur, lui, ne connaît aucune source
 * (Lot 133).
 */
public interface CoverImageCheck {

    boolean estUtilisable(String url);
}
