package com.iozycore.core.export;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * What an import would do - or just did. The same object serves both:
 * the analysis fills it without writing anything, the application fills it
 * while writing, and the screen compares the two at a glance.
 *
 * <p>Three outcomes per row, never more: <b>created</b> (did not exist),
 * <b>attached</b> (already existed, we linked to it without a duplicate) or
 * <b>ignored</b> (impossible or incomplete, and the remark says why). An
 * import never changes existing data: it adds or abstains.
 */
public record ImportReport(boolean applique, List<Section> sections, List<Remarque> remarques,
                           int remarquesNonListees) {

    public record Section(String cle, String libelle, int crees, int rattaches, int ignores) {
    }

    /** A decision worth reading before applying: an attachment or a skip. */
    public record Remarque(String section, String genre, String sujet, String detail) {
        public static final String RATTACHE = "RATTACHE";
        public static final String IGNORE = "IGNORE";
        public static final String REMPLACE = "REMPLACE";
    }

    /** Accumulator: the counters per section, in the order the import handles them. */
    public static final class Cumul {
        private static final int REMARQUES_MAX = 300;

        private final Map<String, int[]> compteurs = new LinkedHashMap<>();
        private final Map<String, String> libelles = new LinkedHashMap<>();
        private final List<Remarque> remarques = new ArrayList<>();
        private int remarquesNonListees;

        public void section(String cle, String libelle) {
            compteurs.putIfAbsent(cle, new int[3]);
            libelles.putIfAbsent(cle, libelle);
        }

        public void cree(String cle) {
            compteurs.get(cle)[0]++;
        }

        public void rattache(String cle, String sujet, String detail) {
            compteurs.get(cle)[1]++;
            remarque(cle, Remarque.RATTACHE, sujet, detail);
        }

        public void ignore(String cle, String sujet, String raison) {
            compteurs.get(cle)[2]++;
            remarque(cle, Remarque.IGNORE, sujet, raison);
        }

        public void remplace(String cle, String sujet, String detail) {
            compteurs.get(cle)[1]++;
            remarque(cle, Remarque.REMPLACE, sujet, detail);
        }

        private void remarque(String cle, String genre, String sujet, String detail) {
            if (remarques.size() >= REMARQUES_MAX) {
                remarquesNonListees++;
                return;
            }
            remarques.add(new Remarque(cle, genre, sujet, detail));
        }

        public ImportReport rapport(boolean applique) {
            List<Section> sections = new ArrayList<>();
            compteurs.forEach((cle, c) -> sections.add(new Section(cle, libelles.get(cle), c[0], c[1], c[2])));
            return new ImportReport(applique, sections, List.copyOf(remarques), remarquesNonListees);
        }
    }
}
