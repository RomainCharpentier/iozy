package com.iozycore.export;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Ce qu'un import ferait - ou vient de faire. Le meme objet sert aux deux :
 * l'analyse le remplit sans rien ecrire, l'application le remplit en
 * ecrivant, et l'ecran compare les deux d'un coup d'oeil.
 *
 * <p>Trois issues par ligne, jamais plus : <b>cree</b> (n'existait pas),
 * <b>rattache</b> (existait deja, on s'y est raccorde sans doublon) ou
 * <b>ignore</b> (impossible ou incomplet, et la remarque dit pourquoi). Un
 * import ne modifie jamais une donnee existante : il ajoute ou s'abstient.
 */
public record ImportReport(boolean applique, List<Section> sections, List<Remarque> remarques,
                           int remarquesNonListees) {

    public record Section(String cle, String libelle, int crees, int rattaches, int ignores) {
    }

    /** Une decision qui merite d'etre lue avant d'appliquer : un rattachement ou un abandon. */
    public record Remarque(String section, String genre, String sujet, String detail) {
        public static final String RATTACHE = "RATTACHE";
        public static final String IGNORE = "IGNORE";
        public static final String REMPLACE = "REMPLACE";
    }

    /** Accumulateur : les compteurs par section, dans l'ordre ou l'import les traite. */
    static final class Cumul {
        private static final int REMARQUES_MAX = 300;

        private final Map<String, int[]> compteurs = new LinkedHashMap<>();
        private final Map<String, String> libelles = new LinkedHashMap<>();
        private final List<Remarque> remarques = new ArrayList<>();
        private int remarquesNonListees;

        void section(String cle, String libelle) {
            compteurs.putIfAbsent(cle, new int[3]);
            libelles.putIfAbsent(cle, libelle);
        }

        void cree(String cle) {
            compteurs.get(cle)[0]++;
        }

        void rattache(String cle, String sujet, String detail) {
            compteurs.get(cle)[1]++;
            remarque(cle, Remarque.RATTACHE, sujet, detail);
        }

        void ignore(String cle, String sujet, String raison) {
            compteurs.get(cle)[2]++;
            remarque(cle, Remarque.IGNORE, sujet, raison);
        }

        void remplace(String cle, String sujet, String detail) {
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

        ImportReport rapport(boolean applique) {
            List<Section> sections = new ArrayList<>();
            compteurs.forEach((cle, c) -> sections.add(new Section(cle, libelles.get(cle), c[0], c[1], c[2])));
            return new ImportReport(applique, sections, List.copyOf(remarques), remarquesNonListees);
        }
    }
}
