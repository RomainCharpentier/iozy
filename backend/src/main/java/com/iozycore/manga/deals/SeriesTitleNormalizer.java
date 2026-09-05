package com.iozycore.manga.deals;

/**
 * Retire la <b>décoration d'annonce</b> autour d'un titre de série, avant de
 * chercher celui-ci au catalogue.
 *
 * <h2>Le défaut corrigé</h2>
 * Une annonce s'intitule « 🔥 Hell's Paradise — Tomes 6 à 10 ». Le titre
 * probable qu'on en tire garde son emoji, et « 🔥 Hell's Paradise » ne
 * correspond à aucune fiche « Hell's Paradise » : la série existe au
 * catalogue, mais elle ressort « pas encore dans votre catalogue ». Le vendeur
 * décorait son annonce, pas le nom de l'œuvre.
 *
 * <h2>Périphérique seulement - la règle qui tient tout ce fichier</h2>
 * On ne retire que ce qui <b>entoure</b> le titre, jamais ce qui le compose.
 * Un titre réel contient légitimement apostrophes, tirets, deux-points, points
 * d'exclamation ou d'interrogation : {@code K-ON!},
 * {@code Kaguya-sama: Love Is War}, {@code D.Gray-man},
 * {@code Don't Call It Mystery}. Les rogner « pour simplifier » remplacerait
 * un titre introuvable par un autre.
 *
 * <p>Un symbole <b>au milieu</b> d'un titre est donc conservé sans discuter :
 * rien ne permet d'affirmer qu'il décore plutôt qu'il ne nomme.
 *
 * <h2>Ce que « décoratif » veut dire, précisément</h2>
 * Les catégories Unicode des symboles ({@code So}, {@code Sk} - emoji, étoiles,
 * pictogrammes), les crochets et guillemets ouvrants/fermants, les tirets, et
 * les caractères de formatage invisibles (sélecteurs de variante, liants sans
 * chasse) qu'un emoji traîne derrière lui. La ponctuation ordinaire n'en fait
 * <b>pas</b> partie : c'est ce qui sauve {@code K-ON!}.
 *
 * <h2>Normaliser n'est pas réécrire</h2>
 * Le texte d'origine reste disponible ailleurs (voir
 * {@code RecognizedItem.seriesTitleRaw}) : cette classe produit le candidat
 * envoyé au catalogue, pas la trace de ce que l'annonce disait.
 */
public final class SeriesTitleNormalizer {

    private SeriesTitleNormalizer() {
    }

    /**
     * Le titre débarrassé de sa décoration périphérique.
     *
     * <p>Rend le titre d'origine (simplement rogné) si le nettoyage ne laissait
     * rien : un titre entièrement composé de symboles n'est pas exploitable,
     * mais le remplacer par une chaîne vide ferait perdre la seule information
     * disponible.
     */
    public static String normalize(String rawTitle) {
        if (rawTitle == null) {
            return "";
        }
        String titre = rawTitle.trim();
        if (titre.isEmpty()) {
            return "";
        }

        int debut = 0;
        int fin = titre.length();

        while (debut < fin) {
            int codePoint = titre.codePointAt(debut);
            if (!estDecoratif(codePoint)) {
                break;
            }
            debut += Character.charCount(codePoint);
        }

        while (fin > debut) {
            int codePoint = titre.codePointBefore(fin);
            if (!estDecoratif(codePoint)) {
                break;
            }
            fin -= Character.charCount(codePoint);
        }

        // Les espaces multiples laissés par la décoration retirée : « 🔥  Hell's
        // Paradise » ne doit pas devenir « ␣Hell's Paradise ».
        String nettoye = titre.substring(debut, fin).replaceAll("\\s+", " ").trim();
        return nettoye.isEmpty() ? titre : nettoye;
    }

    /**
     * Vrai pour un caractère qui décore un titre sans en faire partie.
     *
     * <p>Volontairement restrictif : tout ce qui n'est pas listé ici survit.
     * Se tromper en gardant un caractère coûte un appariement manqué ; se
     * tromper en le retirant fabrique un titre qui n'existe pas.
     */
    private static boolean estDecoratif(int codePoint) {
        if (Character.isWhitespace(codePoint) || estSelecteurDeVariante(codePoint)) {
            return true;
        }
        return switch (Character.getType(codePoint)) {
            // Emoji, étoiles, pictogrammes, symboles modificateurs.
            case Character.OTHER_SYMBOL, Character.MODIFIER_SYMBOL -> true;
            // 【 】 ( ) [ ] « » “ ” - un vrai titre n'ouvre ni ne ferme sur ses bords.
            case Character.START_PUNCTUATION, Character.END_PUNCTUATION,
                 Character.INITIAL_QUOTE_PUNCTUATION, Character.FINAL_QUOTE_PUNCTUATION -> true;
            // Tirets et cadratins de séparation : « Hell's Paradise — » .
            case Character.DASH_PUNCTUATION -> true;
            // Liants sans chasse et autres caractères de formatage : la ferraille
            // invisible qu'un emoji laisse derrière lui.
            case Character.FORMAT, Character.CONTROL, Character.UNASSIGNED -> true;
            default -> false;
        };
    }

    /**
     * Les sélecteurs de variante, visés <b>nommément</b> plutôt que par leur
     * catégorie Unicode.
     *
     * <p>U+FE0F - celui qui suit « ❤ » pour en faire un emoji coloré - est
     * classé {@code Mn}, comme les accents combinants. Retirer toute la
     * catégorie transformerait un « Café » décomposé (e + accent aigu) en
     * « Cafe » quand l'accent se trouve en dernière position. Une correction
     * de décoration ne doit pas changer l'orthographe d'un titre.
     */
    private static boolean estSelecteurDeVariante(int codePoint) {
        return (codePoint >= 0xFE00 && codePoint <= 0xFE0F)
                || (codePoint >= 0xE0100 && codePoint <= 0xE01EF);
    }
}
