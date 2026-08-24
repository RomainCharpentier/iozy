package com.iozycore.purchaseanalysis;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Devine ce qu'une annonce contient, à partir de son seul texte.
 *
 * <h2>Déterministe, jamais devin</h2>
 * Des règles écrites, pas un modèle : « tomes 1 à 14 » donne 1..14 parce que la
 * phrase le dit, pas parce qu'un score de vraisemblance l'estime. Une annonce
 * qui n'annonce rien de précis - « lot manga divers » - ne produit
 * <b>rien</b>. Inventer une intégrale de 12 tomes à partir de trois mots
 * fabriquerait un verdict d'achat calculé sur des tomes qui n'existent pas,
 * ce qui est bien pire que de ne rien proposer.
 *
 * <h2>Une proposition, jamais une vérité</h2>
 * Le résultat est destiné à être <b>confirmé par l'utilisateur</b> avant
 * d'entrer dans l'analyse. {@link Detection#needsConfirmation()} dit quand le
 * doute est tel qu'il faut le signaler à l'écran.
 *
 * <h2>Ce que cette classe ne fait pas</h2>
 * Elle ne consulte ni le catalogue, ni la collection, ni le réseau : c'est une
 * fonction du texte vers des numéros. Le rapprochement avec une série connue
 * revient à {@link SeriesMatcher}, et la confrontation aux possessions à
 * {@link CollectionFit}.
 */
public final class ListingTextParser {

    /**
     * Au-delà, on refuse : « tomes 1 à 900 » est une coquille ou un autre
     * usage du mot, pas un lot. Sans cette borne, une plage absurde ferait
     * exploser le calcul du prix par tome.
     */
    private static final int NUMERO_DE_TOME_MAX = 300;

    /** Ce qui annonce un numéro de tome : « tome », « tomes », « volume », « vol. », « t. », « T ». */
    private static final String PREFIXE_TOME = "(?:tomes?|volumes?|vol\\.?|t\\.?)";

    /**
     * « tome 1 à 14 », « 1 à 14 », « du 1 au 14 », « T1 à T6 », « 1-6 ».
     * <p>
     * Le préfixe est accepté <b>des deux côtés</b> : « T1 à T6 » est aussi
     * courant que « tomes 1 à 6 », et sans cela le « T6 » restait collé au
     * titre.
     */
    private static final Pattern PLAGE_EN_LETTRES = Pattern.compile(
            "(?i)\\b" + PREFIXE_TOME + "?\\s*(?:du\\s*)?(\\d{1,3})\\s*(?:à|a|au|-|–|/)\\s*"
                    + PREFIXE_TOME + "?\\s*(\\d{1,3})\\b");

    /**
     * « tomes 1, 2, 3, 5 », « tomes 1 et 2 » - la liste doit être introduite,
     * sinon tout nombre du texte serait un tome.
     */
    private static final Pattern LISTE_INTRODUITE = Pattern.compile(
            "(?i)\\b" + PREFIXE_TOME + "\\s*((?:\\d{1,3}\\s*(?:,|\\+|&|et)\\s*)+\\d{1,3})\\b");

    /** « tome 7 » seul. */
    private static final Pattern TOME_UNIQUE = Pattern.compile(
            "(?i)\\b" + PREFIXE_TOME + "\\s*(\\d{1,3})\\b");

    /**
     * Les mentions commerciales d'une annonce, qui ne font pas partie du nom
     * d'une œuvre. Retirées comme <b>mots entiers</b> : « lot » disparaît de
     * « Lot Death Note », pas de « Camelot ».
     */
    private static final Pattern MOTS_COMMERCIAUX = Pattern.compile(
            "(?i)\\b(?:int[ée]grale|s[ée]rie compl[èe]te|collection compl[èe]te|lot complet|coffret|lot"
                    + "|neuf|comme neuf|tbe|be)\\b");

    /**
     * Les séparateurs qu'une annonce pose <b>autour</b> de ses informations.
     * Rognés aux extrémités seulement : « Hell's Paradise – » perd son tiret,
     * « Kaguya-sama: Love Is War » garde le sien, et un « - » au milieu d'un
     * titre n'est jamais touché faute de pouvoir prouver qu'il sépare.
     */
    private static final Pattern SEPARATEURS_AUX_BORDS = Pattern.compile("^[\\s\\-–—|:;,/]+|[\\s\\-–—|:;,/]+$");

    /** Annonce un ensemble sans en donner les bornes : on le note, on n'en déduit pas de numéros. */
    private static final Pattern MENTION_INTEGRALE = Pattern.compile(
            "int[ée]grale|s[ée]rie compl[èe]te|collection compl[èe]te|lot complet|coffret complet");

    /** Formulations trop vagues pour qu'un numéro trouvé à côté veuille dire quoi que ce soit. */
    private static final Pattern MENTION_VAGUE = Pattern.compile(
            "lot (?:de )?mangas? divers|lot divers|mangas? divers|lot vari[ée]|divers mangas?|lot de livres divers");

    private ListingTextParser() {
    }

    /**
     * Ce que le texte a livré.
     *
     * @param volumeNumbers    numéros lus explicitement - vide quand le texte ne les donne pas
     * @param mentionsComplete l'annonce se dit « intégrale » / « série complète » sans donner les bornes
     * @param vague            formulation trop imprécise pour identifier quoi que ce soit
     */
    public record Detection(Set<Integer> volumeNumbers, boolean mentionsComplete, boolean vague) {

        public Detection {
            volumeNumbers = volumeNumbers == null ? Set.of() : new TreeSet<>(volumeNumbers);
        }

        public static Detection rien() {
            return new Detection(Set.of(), false, false);
        }

        public boolean hasVolumes() {
            return !volumeNumbers.isEmpty();
        }

        /**
         * Vrai quand l'utilisateur doit regarder de près avant de lancer l'analyse :
         * soit rien n'a été identifié, soit le texte annonce un ensemble complet
         * dont on ignore la taille (« intégrale » sans numéros), soit il est
         * délibérément vague.
         */
        public boolean needsConfirmation() {
            return vague || !hasVolumes();
        }
    }

    /** Lit le titre puis, seulement s'il n'a rien donné, la description - le titre est bien plus fiable. */
    public static Detection parse(String title, String description) {
        String titre = normaliser(title);
        String texte = normaliser(description);

        boolean vague = MENTION_VAGUE.matcher(titre).find()
                || (titre.isBlank() && MENTION_VAGUE.matcher(texte).find());
        if (vague) {
            // Une formulation vague empoisonne tout ce qui l'entoure : « lot manga
            // divers 25 pièces » ne décrit pas les tomes 25.
            return new Detection(Set.of(), false, true);
        }

        Set<Integer> depuisTitre = numeros(titre);
        Set<Integer> numeros = !depuisTitre.isEmpty() ? depuisTitre : numeros(texte);
        boolean complete = MENTION_INTEGRALE.matcher(titre).find() || MENTION_INTEGRALE.matcher(texte).find();

        return new Detection(numeros, complete, false);
    }

    /**
     * Ce qu'un texte dit des tomes, <b>et</b> ce qu'il en reste une fois ces
     * expressions retirées.
     *
     * <p>Rendre les deux ensemble est tout l'intérêt : le titre probable
     * s'obtient en enlevant <b>exactement le segment reconnu</b>, jamais en
     * supprimant tous les chiffres et toute la ponctuation. « 20th Century
     * Boys tomes 1 à 5 » perd « tomes 1 à 5 » et garde son « 20 ».
     *
     * @param numeros les tomes lus - vide si le texte n'en décrit aucun
     * @param reste   le texte privé des expressions de tomes reconnues
     */
    record ExpressionsDeTomes(Set<Integer> numeros, String reste) {
    }

    /**
     * Les numéros d'un texte, par ordre de fiabilité décroissante : une plage
     * explicite, sinon une liste introduite par « tomes », sinon des tomes
     * cités un à un. On ne descend au niveau suivant que si le précédent n'a
     * rien donné - mélanger les trois ferait entrer des nombres qui ne sont pas
     * des tomes (année, prix, nombre de pièces).
     */
    static ExpressionsDeTomes extraire(String texte) {
        if (texte == null || texte.isBlank()) {
            return new ExpressionsDeTomes(Set.of(), "");
        }
        // Une plage RECONNUE mais rejetée (bornes absurdes, ordre inversé) arrête
        // tout : le texte décrit clairement un intervalle qu'on n'a pas su lire.
        // Sans ce garde, « tomes 1 à 900 » retombait sur l'heuristique du tome
        // isolé et rendait [1] - un lot d'un seul tome là où l'annonce en
        // annonce des centaines, donc un prix par tome et un verdict faux.
        //
        // Le segment reste retiré du titre dans tous les cas : il décrit bien
        // des tomes, même mal formés.
        if (PLAGE_EN_LETTRES.matcher(texte).find()) {
            return new ExpressionsDeTomes(depuisPlages(texte),
                    PLAGE_EN_LETTRES.matcher(texte).replaceAll(" "));
        }
        Set<Integer> listes = depuisListes(texte);
        if (!listes.isEmpty()) {
            return new ExpressionsDeTomes(listes, LISTE_INTRODUITE.matcher(texte).replaceAll(" "));
        }
        Set<Integer> isoles = depuisTomesIsoles(texte);
        if (!isoles.isEmpty()) {
            return new ExpressionsDeTomes(isoles, TOME_UNIQUE.matcher(texte).replaceAll(" "));
        }
        return new ExpressionsDeTomes(Set.of(), texte);
    }

    private static Set<Integer> numeros(String texte) {
        return extraire(texte).numeros();
    }

    private static Set<Integer> depuisPlages(String texte) {
        Set<Integer> numeros = new TreeSet<>();
        Matcher m = PLAGE_EN_LETTRES.matcher(texte);
        while (m.find()) {
            int debut = Integer.parseInt(m.group(1));
            int fin = Integer.parseInt(m.group(2));
            // Une plage descendante ou hors bornes n'est pas une plage de tomes.
            if (debut >= 1 && fin >= debut && fin <= NUMERO_DE_TOME_MAX) {
                for (int i = debut; i <= fin; i++) {
                    numeros.add(i);
                }
            }
        }
        return numeros;
    }

    private static Set<Integer> depuisListes(String texte) {
        Set<Integer> numeros = new TreeSet<>();
        Matcher m = LISTE_INTRODUITE.matcher(texte);
        while (m.find()) {
            for (String morceau : m.group(1).split("(?i)\\s*(?:,|\\+|&|et)\\s*")) {
                ajouterSiValide(numeros, morceau.trim());
            }
        }
        return numeros;
    }

    private static Set<Integer> depuisTomesIsoles(String texte) {
        Set<Integer> numeros = new TreeSet<>();
        Matcher m = TOME_UNIQUE.matcher(texte);
        while (m.find()) {
            ajouterSiValide(numeros, m.group(1));
        }
        return numeros;
    }

    private static void ajouterSiValide(Set<Integer> numeros, String brut) {
        if (!brut.matches("\\d{1,3}")) {
            return;
        }
        int n = Integer.parseInt(brut);
        if (n >= 1 && n <= NUMERO_DE_TOME_MAX) {
            numeros.add(n);
        }
    }

    /**
     * Le titre de série probable : ce qui reste une fois retirés les numéros,
     * les mots de lot et la ponctuation. Rendu tel quel à
     * {@link SeriesMatcher}, qui décidera s'il correspond à une série connue -
     * cette méthode ne prétend pas connaître le catalogue.
     */
    public static String probableSeriesTitle(String title) {
        if (title == null || title.isBlank()) {
            return "";
        }
        // Retirer SEULEMENT ce qui a été reconnu comme expression de tomes, puis
        // les mentions commerciales, puis les séparateurs des bords.
        //
        // Cette méthode supprimait auparavant TOUS les chiffres et TOUTE la
        // ponctuation avant d'espérer que le reste soit le titre. « 20th Century
        // Boys » y devenait « th Century Boys », « Kaguya-sama: Love Is War »
        // devenait « Kaguya sama Love Is War », et aucune normalisation en aval
        // ne pouvait reconstruire ce qui était détruit. Les chiffres et la
        // ponctuation appartiennent souvent à l'identité d'une œuvre.
        String reste = extraire(title).reste();
        reste = MOTS_COMMERCIAUX.matcher(reste).replaceAll(" ");
        reste = reste.replaceAll("\\s+", " ").trim();
        reste = SEPARATEURS_AUX_BORDS.matcher(reste).replaceAll("");
        return reste.replaceAll("\\s+", " ").trim();
    }

    private static String normaliser(String valeur) {
        return valeur == null ? "" : valeur.toLowerCase(Locale.ROOT);
    }

    /** Utilitaire de lecture : les numéros triés, pour l'affichage et les tests. */
    public static List<Integer> sorted(Set<Integer> numeros) {
        return new ArrayList<>(new LinkedHashSet<>(new TreeSet<>(numeros)));
    }
}
