package com.iozycore.core.insights;

import java.util.Objects;
import java.util.UUID;

/**
 * Une ligne du calendrier des sorties : ce qui sort, quand, et ce que ça
 * représente pour la collection de l'utilisateur.
 *
 * <p>La relation est ce qui distingue un calendrier d'une page de nouveautés :
 * un tome qui sort et qu'on n'a pas est une action, un tome qu'on a déjà est
 * une confirmation, une œuvre qu'on veut est une attente. Elle est toujours
 * écrite - la même règle que les opportunités de Découvrir (« la raison,
 * toujours écrite »).
 *
 * @param date         quand, à la précision que la source connaît
 * @param entityId     l'œuvre du catalogue - la ligne y mène
 * @param entityTitle  son titre, tel que la fiche l'affiche
 * @param entityTypeId sa catégorie - le client filtre et étiquette par elle
 * @param label        ce qui sort au sein de l'œuvre (« Tome 42 · Kana »), vide quand c'est l'œuvre elle-même
 * @param volumeNumber le numéro de tome, ou {@code null} hors manga
 * @param editionName  l'édition du tome, ou {@code null}
 * @param coverImageUrl la jaquette de ce qui sort, ou {@code null}
 * @param relation     ce que cette sortie représente pour la collection
 * @param source       d'où vient la date - nommée, jamais devinée
 */
public record ReleaseEntry(ReleaseDate date, UUID entityId, String entityTitle, UUID entityTypeId,
                            String label, Integer volumeNumber, String editionName, String coverImageUrl,
                            Relation relation, String source) {

    public enum Relation {
        /** Déjà dans la collection. */
        OWNED,
        /** L'œuvre est dans la collection, ce tome-là n'y est pas. */
        MISSING,
        /** Dans les envies. */
        WANTED
    }

    public ReleaseEntry {
        Objects.requireNonNull(date, "date");
        Objects.requireNonNull(entityId, "entityId");
        Objects.requireNonNull(entityTypeId, "entityTypeId");
        Objects.requireNonNull(relation, "relation");
        Objects.requireNonNull(source, "source");
        entityTitle = entityTitle == null ? "" : entityTitle;
        label = label == null ? "" : label;
    }
}
