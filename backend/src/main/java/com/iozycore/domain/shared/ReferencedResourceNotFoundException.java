package com.iozycore.domain.shared;

/**
 * Une écriture référence une ressource qui n'existe pas.
 *
 * <h2>Pourquoi un type à part</h2>
 * Sans lui, ce cas n'avait que deux issues, toutes deux fausses. Laissé à la
 * clé étrangère de PostgreSQL, il ressortait en <b>409</b> « Cette donnée entre
 * en conflit avec une donnée existante » - or rien n'entre en conflit, la
 * donnée est simplement absente. Traduit en {@link IllegalArgumentException},
 * il devenait un <b>400</b>, ce qui décrit une requête mal formée alors qu'elle
 * est parfaitement formée et désigne seulement quelque chose de disparu.
 *
 * <h2>Où il vit</h2>
 * Dans le domaine, levé par les services, mappé en <b>404</b> par
 * {@code ApiExceptionHandler} - comme les quatre exceptions de suppression
 * refusée le sont en 409. Aucune couche métier n'a ainsi besoin de connaître
 * HTTP pour que le bon status sorte.
 */
public class ReferencedResourceNotFoundException extends RuntimeException {

    public ReferencedResourceNotFoundException(String message) {
        super(message);
    }
}
