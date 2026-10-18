package com.iozycore.core.export;

import com.iozycore.core.domain.catalog.Entity;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * What a universe sees of an import in progress (Batch 133): the document, the
 * mode (simulation or write), the report, and the matches already
 * made between the ids of the file and those of the database - works,
 * volumes, editions. The editions table is filled by the module and read
 * by the core, which links the volumes to their edition.
 */
public final class ImportContexte {

    public final ExportDocument doc;
    public final boolean ecrire;
    public final ImportReport.Cumul cumul;
    /** Work id from the file -> work in the database (created or found). */
    public final Map<UUID, Entity> oeuvres;
    /** Volume id from the file -> volume id in the database. */
    public final Map<UUID, UUID> tomes;
    /** Edition id from the file -> edition id in the database. */
    public final Map<UUID, UUID> editions;
    /** The works that this import creates (as opposed to those already in the catalog). */
    public final Set<UUID> oeuvresACreer;

    public ImportContexte(ExportDocument doc, boolean ecrire, ImportReport.Cumul cumul, Map<UUID, Entity> oeuvres,
                          Map<UUID, UUID> tomes, Map<UUID, UUID> editions, Set<UUID> oeuvresACreer) {
        this.doc = doc;
        this.ecrire = ecrire;
        this.cumul = cumul;
        this.oeuvres = oeuvres;
        this.tomes = tomes;
        this.editions = editions;
        this.oeuvresACreer = oeuvresACreer;
    }

    /** The database id of the work that the file designates this way, or null if it was not imported. */
    public UUID oeuvreId(UUID ancienId) {
        if (ancienId == null) {
            return null;
        }
        Entity oeuvre = oeuvres.get(ancienId);
        return oeuvre == null ? null : oeuvre.id();
    }

    public static <T> List<T> liste(List<T> l) {
        return l == null ? List.of() : l;
    }

    public static String nonVide(String s, String sinon) {
        return s == null || s.isBlank() ? sinon : s;
    }

    public static <E extends Enum<E>> E enumOuNull(Class<E> type, String nom) {
        if (nom == null || nom.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, nom.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
