package com.iozycore.purchaseanalysis;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * L'édition nommée dans le titre d'une annonce — « Naruto <b>Perfect
 * Edition</b> tomes 1 à 3 ».
 *
 * <h2>Ce que son absence coûtait, et ce n'était pas seulement l'édition</h2>
 * Le parser ne lisait pas l'édition : elle restait donc collée au titre. « Naruto
 * Perfect Edition » ressortait comme une <b>série nommée « Naruto Perfect
 * Edition »</b>, que le catalogue ne connaît évidemment pas — là où « Naruto »
 * seul retrouvait sa fiche et ses éditions.
 *
 * <p>Mentionner l'édition, ce que les vendeurs font constamment, faisait donc
 * <b>perdre la série</b>. Le manque d'une information en détruisait une autre.
 *
 * <h2>Une liste, et pourquoi elle est inévitable</h2>
 * La première version pariait sur le mot « édition » pour qualifier son voisin,
 * sans liste à tenir. Elle lisait « Death Note edition » comme une édition
 * <b>« Note »</b> : rien dans la phrase ne dit lequel des deux mots est le nom
 * de l'œuvre et lequel celui du tirage.
 *
 * <p>Le qualifiant doit donc être <b>reconnu</b> — sauf à une position : quand
 * il <b>suit</b> le mot « édition ». Là il n'y a plus d'ambiguïté, car personne
 * n'écrit le nom de l'œuvre après ce mot ; « édition Hokage » se lit tout seul,
 * et n'importe quel qualifiant y est accepté.
 *
 * <h2>Manquer une édition, jamais en inventer</h2>
 * « Dragon Ball Star Edition » n'est pas reconnu : « Star » n'est pas dans la
 * liste. C'est un manque assumé — l'élément reste « édition à confirmer »,
 * exactement comme avant, et l'utilisateur tranche. L'erreur inverse serait
 * bien plus coûteuse : un indice inventé fait chercher au catalogue une édition
 * qui n'existe pas, et fait passer pour douteux un élément parfaitement
 * identifié.
 *
 * <h2>Ce qui n'est délibérément pas une édition</h2>
 * « Coffret » décrit un emballage, « neuf » et « TBE » un état, « lot » une
 * vente. Ces mots sont retirés du titre par {@code MOTS_COMMERCIAUX} et n'ont
 * rien à faire dans un indice d'édition.
 */
public final class EditionMention {

    /**
     * Les qualifiants d'édition du manga francophone.
     *
     * <p>Chaque entrée est un mot qui cesse d'appartenir aux titres d'œuvres :
     * la liste est donc courte et se justifie mot à mot. « Black » n'y est pas
     * — <i>Black Butler</i>, <i>Black Clover</i>, <i>Black Lagoon</i> sont des
     * séries. « Star » non plus, pour la même raison.
     */
    private static final Set<String> QUALIFIANTS = Set.of(
            "perfect", "deluxe", "luxe", "prestige", "collector", "integrale",
            "originale", "original", "limitee", "limite", "souple", "double",
            "simple", "anniversaire", "ultimate", "kanzenban", "bunko", "shinsoban");

    /**
     * Les rangs qu'un vendeur écrit seuls, sans le mot « édition ».
     *
     * <p><b>« Intégrale » n'y est pas</b>, et l'absence est instructive. Ce mot
     * porte déjà un sens dans ce code : {@code MENTION_INTEGRALE} en fait un
     * signal de <i>complétude</i> — « le lot contient toute la série » — pas un
     * nom de tirage. L'y ajouter a été essayé et rejeté par les tests : sur
     * « Platinum End intégrale tomes 1 à 14 », le texte proposait quatorze tomes
     * en édition « Intégrale » pendant que les photos en voyaient douze en
     * « Standard », et la consolidation - qui refuse à juste titre de fondre
     * deux éditions différentes - rendait <b>vingt-six</b> tomes pour un lot de
     * quatorze.
     *
     * <p>Il reste accepté dans {@link #QUALIFIANTS}, c'est-à-dire uniquement
     * accolé au mot « édition » : « édition intégrale » nomme bien un tirage,
     * là où « intégrale » seul décrit un ensemble.
     */
    private static final Set<String> RANGS_SEULS = Set.of(
            "perfect", "deluxe", "prestige", "collector", "kanzenban", "bunko");

    /**
     * Les drapeaux, et pourquoi ils ne sont pas optionnels.
     *
     * <p>{@code \b} en Java s'appuie sur {@code \w}, qui vaut par défaut
     * {@code [a-zA-Z0-9_]} : <b>« é » n'y est pas un caractère de mot</b>. Une
     * limite de mot posée devant « édition » ne se déclenche donc jamais, et
     * tous les motifs français échouaient en silence — « Naruto édition
     * Hokage » ne rendait rien du tout. {@code UNICODE_CHARACTER_CLASS} range
     * les lettres accentuées du bon côté.
     */
    private static final int DRAPEAUX =
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE | Pattern.UNICODE_CHARACTER_CLASS;

    /**
     * « … édition Hokage » : un mot <b>suit</b> « édition ».
     *
     * <p>C'est la seule position où un qualifiant inconnu est accepté, et elle
     * est sûre par construction : personne n'écrit le nom de l'œuvre après le
     * mot « édition ». L'ambiguïté qui a fait abandonner la première version
     * était l'autre position — « Death Note edition », où rien ne dit lequel des
     * deux mots précédents est l'œuvre.
     *
     * <p>L'accent n'est pas exigé : les vendeurs écrivent « edition Hokage »
     * aussi souvent que « édition Hokage », et la construction est la même.
     */
    private static final Pattern EDITION_PUIS_MOT =
            Pattern.compile("\\b[ée]ditions?\\s+([\\p{L}0-9'’-]{2,})\\b", DRAPEAUX);

    /** « … Perfect Edition », « … édition collector » - le qualifiant doit être reconnu. */
    private static final Pattern QUALIFIANT_ET_EDITION =
            Pattern.compile("\\b([\\p{L}0-9'’-]{2,})\\s+[ée]ditions?\\b", DRAPEAUX);

    private static final Pattern EDITION_ET_QUALIFIANT =
            Pattern.compile("\\b[ée]ditions?\\s+([\\p{L}0-9'’-]{2,})\\b", DRAPEAUX);

    private static final Pattern RANG_SEUL = Pattern.compile(
            "\\b(perfect|deluxe|prestige|collector|kanzenban|bunko)\\b", DRAPEAUX);

    /**
     * Ce qu'un titre dit de son édition, et ce qu'il en reste sans elle.
     *
     * @param hint  le libellé lu, mis en forme (« Perfect Edition ») — {@code null}
     *              si le titre n'en nomme aucune de reconnaissable
     * @param reste le titre privé de cette mention, prêt pour la recherche de série
     */
    public record Lecture(String hint, String reste) {

        static Lecture aucune(String titre) {
            return new Lecture(null, titre == null ? "" : titre);
        }

        public boolean trouvee() {
            return hint != null;
        }
    }

    private EditionMention() {
    }

    /**
     * @param titre le titre de l'annonce, <b>déjà privé de ses expressions de
     *              tomes</b> — sans quoi « tomes 1 à 3 edition » pourrait passer
     *              pour une édition nommée « 3 »
     */
    public static Lecture lire(String titre) {
        if (titre == null || titre.isBlank()) {
            return Lecture.aucune(titre);
        }

        // 1. « édition Hokage » : le seul cas où un mot inconnu est accepté,
        //    parce que la construction française ne laisse aucun doute sur
        //    lequel des deux mots qualifie l'autre.
        Matcher francaise = EDITION_PUIS_MOT.matcher(titre);
        if (francaise.find() && !estCreux(francaise.group(1))) {
            return retenir(titre, francaise, francaise.group(1));
        }

        // 2. Un qualifiant RECONNU, avant ou après le mot « edition ».
        for (Pattern motif : List.of(QUALIFIANT_ET_EDITION, EDITION_ET_QUALIFIANT)) {
            Matcher m = motif.matcher(titre);
            while (m.find()) {
                if (estUnQualifiant(m.group(1))) {
                    return retenir(titre, m, m.group(1));
                }
            }
        }

        // 3. Un rang employé seul : « Naruto Perfect tomes 1 à 3 ».
        Matcher rang = RANG_SEUL.matcher(titre);
        if (rang.find()) {
            return new Lecture(capitaliser(rang.group(1)), retirer(titre, rang.start(), rang.end()));
        }

        return Lecture.aucune(titre);
    }

    private static Lecture retenir(String titre, Matcher m, String qualifiant) {
        return new Lecture(capitaliser(qualifiant) + " Edition", retirer(titre, m.start(), m.end()));
    }

    private static String retirer(String titre, int debut, int fin) {
        return (titre.substring(0, debut) + " " + titre.substring(fin)).replaceAll("\\s+", " ").trim();
    }

    /**
     * Les mots qui suivent « édition » sans la qualifier.
     *
     * <p>Deux familles, et toutes deux sont nécessaires depuis que l'accent
     * n'est plus exigé :
     * <ul>
     *   <li>les <b>mots vides</b> — « édition de collection » proposerait
     *       sinon une édition « De Edition » ;</li>
     *   <li>les <b>états et mentions de vente</b> — « Naruto Perfect Edition
     *       neuf » proposerait une édition « Neuf Edition », alors que « neuf »
     *       décrit l'exemplaire et que « Perfect » est le vrai qualifiant.</li>
     * </ul>
     */
    private static final Set<String> QUALIFIANTS_CREUX = Set.of(
            "belle", "beau", "bel", "cette", "cet", "ce", "une", "un", "la", "le", "les",
            "des", "de", "du", "en", "et", "son", "sa", "leur", "grande", "grand",
            "petite", "petit", "bonne", "bon", "super", "tres", "avec", "sans", "pour",
            // etats et mentions de vente
            "neuf", "tbe", "be", "occasion", "complet", "complete", "complets", "completes",
            "lot", "coffret", "tome", "tomes", "volume", "volumes", "manga", "mangas",
            "livre", "livres", "serie", "series", "prix", "port", "envoi", "vends", "vendu");

    private static boolean estCreux(String mot) {
        return mot == null || QUALIFIANTS_CREUX.contains(sansAccents(mot));
    }

    private static boolean estUnQualifiant(String mot) {
        return mot != null && QUALIFIANTS.contains(sansAccents(mot));
    }

    /** « Intégrale » et « integrale » désignent la même chose ; la liste n'a pas à les porter deux fois. */
    private static String sansAccents(String mot) {
        return Normalizer.normalize(mot.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
    }

    /**
     * Rendu tel qu'on l'écrirait, pas tel qu'il a été tapé : le libellé finit
     * dans le lot puis dans l'analyse enregistrée, et « PERFECT edition » y
     * ferait tache à côté des éditions du catalogue.
     */
    private static String capitaliser(String mot) {
        String propre = mot.trim();
        if (propre.isEmpty()) {
            return propre;
        }
        return Character.toUpperCase(propre.charAt(0)) + propre.substring(1).toLowerCase(Locale.ROOT);
    }

    /** Vrai si ce libellé est un rang employé seul - exposé pour les tests. */
    static boolean estUnRangConnu(String mot) {
        return mot != null && RANGS_SEULS.contains(sansAccents(mot));
    }
}
