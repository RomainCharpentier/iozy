package com.iozycore.core.domain.shared;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Ce que deux textes doivent avoir en commun pour designer la meme oeuvre.
 *
 * <p>Quatre endroits comparaient des titres, chacun a sa facon : la recherche
 * locale en SQL (casse seule), l'exclusion des titres possedes dans la
 * recherche externe (casse et espaces), et les trois suggestions de
 * Decouvrir (casse seule). Aucun ne pliait les accents ni la ponctuation :
 * « pokemon » ne trouvait pas « Pokémon », « l attaque » ne trouvait pas
 * « L'Attaque des Titans », et un fournisseur qui rend « Pokemon » pour une
 * oeuvre cataloguee « Pokémon » la proposait comme nouvelle.
 *
 * <p>Une seule regle, ici : minuscules, accents retires, tout ce qui n'est ni
 * lettre ni chiffre devient une espace, espaces repliees. Assez large pour
 * qu'une frappe approximative retrouve son oeuvre, assez etroite pour ne pas
 * confondre deux titres distincts.
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

    /** Vrai si {@code requete} (deja normalisee ou non) apparait dans {@code texte}. */
    public static boolean contient(String texte, String requete) {
        String r = normaliser(requete);
        return r.isEmpty() || normaliser(texte).contains(r);
    }

    /**
     * Vrai si chaque mot de {@code requete} apparait dans {@code texte}, dans
     * n'importe quel ordre - les deux DEJA normalises. « attaque titans »
     * retrouve ainsi « l attaque des titans ».
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
