package com.iozycore.core.domain.shared;

import java.text.Normalizer;
import java.util.Locale;

/**
 * What two texts must have in common to designate the same work.
 *
 * <p>Four places compared titles, each in its own way: the local search
 * in SQL (case only), the exclusion of owned titles in the
 * external search (case and spaces), and the three suggestions of
 * Discover (case only). None folded accents or punctuation:
 * "pokemon" did not find "Pokémon", "l attaque" did not find
 * "L'Attaque des Titans", and a provider that returns "Pokemon" for a
 * work cataloged as "Pokémon" offered it as new.
 *
 * <p>One single rule, here: lowercase, accents removed, everything that is neither
 * a letter nor a digit becomes a space, spaces collapsed. Wide enough so
 * that a rough typing finds its work, narrow enough not to
 * mix up two different titles.
 */
public final class TexteRecherche {

    private TexteRecherche() {
    }

    public static String normaliser(String texte) {
        if (texte == null) {
            return "";
        }
        String sansAccents = Normalizer.normalize(texte, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return sansAccents.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim();
    }

    /** True if {@code requete} (already normalized or not) appears in {@code texte}. */
    public static boolean contient(String texte, String requete) {
        String r = normaliser(requete);
        return r.isEmpty() || normaliser(texte).contains(r);
    }

    /**
     * True if every word of {@code requete} appears in {@code texte}, in
     * any order - both ALREADY normalized. "attaque titans"
     * thus finds "l attaque des titans".
     */
    public static boolean contientChaqueMot(String texteNormalise, String requeteNormalisee) {
        if (requeteNormalisee.isEmpty()) {
            return true;
        }
        for (String mot : requeteNormalisee.split(" ")) {
            if (!texteNormalise.contains(mot)) {
                return false;
            }
        }
        return true;
    }
}
