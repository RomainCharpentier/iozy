package com.iozycore.manga.shelfimport;

import java.util.List;
import java.util.UUID;

/**
 * Ce qu'un import a fait, tome par tome.
 *
 * @param items un résultat par tome demandé, dans l'ordre de la demande
 */
public record ShelfImportReport(List<ImportedItem> items) {

    public ShelfImportReport {
        items = items == null ? List.of() : List.copyOf(items);
    }

    public enum Outcome {
        /** Le tome a été ajouté à la collection. */
        ADDED,
        /** Un exemplaire de ce numéro était encore possédé : rien n'a été écrit. */
        ALREADY_OWNED
    }

    /**
     * @param seriesCreated vrai si la série n'existait pas au catalogue et vient d'être créée
     * @param entityId      la série, retrouvée ou créée
     */
    public record ImportedItem(String seriesTitle, int volumeNumber, String edition, Outcome outcome,
                               boolean seriesCreated, UUID entityId) {
    }

    public long added() {
        return items.stream().filter(i -> i.outcome() == Outcome.ADDED).count();
    }

    public long alreadyOwned() {
        return items.stream().filter(i -> i.outcome() == Outcome.ALREADY_OWNED).count();
    }

    public long seriesCreated() {
        return items.stream().filter(ImportedItem::seriesCreated).count();
    }
}
