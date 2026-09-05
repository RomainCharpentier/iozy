package com.iozycore.core.export;

import com.iozycore.core.domain.catalog.Entity;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Ce qu'un univers voit d'un import en cours (Lot 133) : le document, le
 * mode (simulation ou écriture), le rapport, et les correspondances déjà
 * établies entre les identifiants du fichier et ceux de la base - œuvres,
 * tomes, éditions. La table des éditions est remplie par le module et lue
 * par le cœur, qui relie les tomes à leur édition.
 */
public final class ImportContexte {

    public final ExportDocument doc;
    public final boolean ecrire;
    public final ImportReport.Cumul cumul;
    /** Identifiant d'œuvre du fichier → œuvre en base (créée ou retrouvée). */
    public final Map<UUID, Entity> oeuvres;
    /** Identifiant de tome du fichier → identifiant du tome en base. */
    public final Map<UUID, UUID> tomes;
    /** Identifiant d'édition du fichier → identifiant de l'édition en base. */
    public final Map<UUID, UUID> editions;
    /** Les œuvres que cet import crée (par opposition à celles déjà au catalogue). */
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

    /** L'identifiant en base de l'œuvre que le fichier désigne ainsi, ou null si elle n'a pas été importée. */
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
