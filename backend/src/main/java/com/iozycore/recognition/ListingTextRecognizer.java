package com.iozycore.recognition;

import com.iozycore.purchaseanalysis.ListingTextParser;

import java.util.ArrayList;
import java.util.List;

/**
 * Traduit ce que le <b>texte</b> d'une annonce annonce déjà en propositions,
 * dans la même forme que celles venues des photos.
 *
 * <h2>Pourquoi le texte d'abord</h2>
 * « Platinum End intégrale tomes 1 à 14 » dit tout. Le comprendre ne demande
 * ni appel réseau, ni modèle, ni euro, ni seconde d'attente : des règles
 * écrites suffisent. Solliciter un moteur de vision pour retrouver ce que le
 * vendeur a écrit noir sur blanc serait payer pour deviner une information
 * donnée.
 *
 * <h2>Cette classe ne parse rien elle-même</h2>
 * Tout le travail est déjà fait par {@link ListingTextParser}, écrit et testé
 * de longue date - mais qui, jusqu'à cette passe, n'était appelé par
 * <b>aucun code de production</b>. Ce fichier est l'adaptateur qui lui manquait :
 * il convertit sa {@code Detection} en {@link RecognizedItem}, rien de plus.
 * Le parser garde ses règles, ses bornes et ses tests.
 *
 * <h2>Extraction n'est pas vérité</h2>
 * Les propositions rendues ici portent {@link RecognitionConfidence#HIGH}
 * parce que la <b>lecture</b> est certaine : la phrase dit « 1 à 14 ». Cela ne
 * signifie pas que le vendeur a ces quatorze tomes en main. C'est
 * {@link RecognitionSource#TEXT} qui porte cette nuance, et l'écran qui la
 * montre - jamais un score qui mélangerait les deux.
 */
public final class ListingTextRecognizer {

    /**
     * Au-delà, on ne déroule pas : « tomes 1 à 300 » est déjà borné par le
     * parser, mais produire trois cents lignes à cocher serait inutilisable.
     * Un lot de cette taille se saisit autrement.
     */
    static final int MAX_ELEMENTS = 60;

    private ListingTextRecognizer() {
    }

    /**
     * Ce que le titre et la description permettent de proposer - vide si le
     * texte ne dit rien de précis.
     *
     * <p>Rendre une liste vide est un résultat parfaitement normal : « beau lot
     * de mangas » ne décrit aucun tome, et inventer une intégrale à partir de
     * trois mots fabriquerait un verdict d'achat calculé sur des tomes qui
     * n'existent pas.
     */
    public static List<RecognizedItem> recognize(String title, String description) {
        return read(title, description).items();
    }

    /**
     * Ce que le texte a livré : les propositions, <b>et</b> ce qu'il dit du lot
     * sans permettre d'en proposer quoi que ce soit.
     *
     * <h2>« 9 tomes de Naruto »</h2>
     * Cette annonce dit deux choses vraies - une série, et une taille - et une
     * chose qu'elle ne dit pas : <b>lesquels</b>. Jusqu'ici tout était perdu :
     * aucun numéro lisible, donc liste vide, donc écran muet.
     *
     * <p>Dérouler 1 à 9 aurait été le geste facile et le mauvais : le vendeur
     * peut avoir les tomes 14 à 22, et un verdict d'achat calculé sur des tomes
     * inventés serait faux avec l'aplomb d'un calcul. Ces deux faits sont donc
     * rapportés <b>à côté</b> des propositions, jamais dedans - à l'écran de
     * poser la seule question qui reste ouverte.
     *
     * @param items les propositions confirmables - vides quand rien n'est identifiable
     * @param announcedVolumeCount combien de tomes l'annonce dit contenir sans dire lesquels,
     *                             {@code null} sinon. Jamais renseigné en même temps que des {@code items}
     * @param announcedSeriesTitle la série nommée par le titre quand seul le nombre manquait,
     *                             {@code null} si le titre ne désigne aucune œuvre plausible
     */
    public record TextReading(List<RecognizedItem> items, Integer announcedVolumeCount,
                              String announcedSeriesTitle) {

        public TextReading {
            items = items == null ? List.of() : List.copyOf(items);
        }

        static TextReading rien() {
            return new TextReading(List.of(), null, null);
        }
    }

    public static TextReading read(String title, String description) {
        // Un titre qui énumère PLUSIEURS séries se lit segment par segment.
        // Tenté d'abord, et abandonné sans bruit s'il ne tient pas : voir
        // plusieursSeries.
        List<RecognizedItem> multi = plusieursSeries(title);
        if (!multi.isEmpty()) {
            return new TextReading(multi, null, null);
        }

        ListingTextParser.Detection detection = ListingTextParser.parse(title, description);

        // Ni numéros lisibles, ni formulation exploitable : on se tait, et les
        // photos ou la saisie manuelle prennent le relais.
        if (!detection.hasVolumes()) {
            return detection.hasAnnouncedCountOnly()
                    ? nombreSeul(title, detection.announcedVolumeCount())
                    : TextReading.rien();
        }

        String serie = ListingTextParser.probableSeriesTitle(title);
        if (!estUnTitreDeSerie(serie)) {
            // Des numéros sans œuvre identifiable ne font pas des propositions :
            // « lot mangas 1 à 10 » ne dit pas DE QUOI il s'agit, et dix lignes
            // « mangas · tome N » n'aideraient personne - elles nuiraient même,
            // en fabriquant une série qui n'existe pas.
            return TextReading.rien();
        }

        List<Integer> numeros = ListingTextParser.sorted(detection.volumeNumbers());
        if (numeros.size() > MAX_ELEMENTS) {
            return TextReading.rien();
        }

        String raison = evidence(numeros);
        List<RecognizedItem> propositions = new ArrayList<>(numeros.size());
        for (Integer numero : numeros) {
            // Pas d'édition : le parser n'en lit pas, et en supposer une serait
            // exactement ce que ce projet refuse. Les photos ou l'utilisateur
            // la compléteront.
            propositions.add(RecognizedItem.fromText(serie, numero, raison));
        }
        return new TextReading(propositions, null, null);
    }

    /**
     * Les séparateurs qu'une annonce pose <b>entre deux œuvres</b>.
     *
     * <p>Le tiret en est délibérément absent : il sépare des tomes bien plus
     * souvent que des séries (« 1-3 »), et il appartient à des titres entiers
     * (« Kaguya-sama »). Découper dessus casserait plus qu'il ne réparerait.
     */
    private static final java.util.regex.Pattern SEPARATEURS_DE_SERIES =
            java.util.regex.Pattern.compile("(?i)\\s*(?:\\+|,|;|/|&|\\bet\\b)\\s*");

    /** Au-delà, ce n'est plus une énumération d'œuvres mais une liste de courses. */
    private static final int MAX_SERIES = 8;

    /**
     * Les propositions d'un titre qui énumère <b>plusieurs</b> séries.
     *
     * <h2>Ce qui se passait avant</h2>
     * « Death Note 1-3 + Bakuman 1-2 » ne rendait pas « une série sur deux » :
     * il rendait <b>trois tomes attribués à une série nommée « Death Note +
     * Bakuman »</b>. Deux dégâts d'un coup - un titre qui ne correspondra
     * jamais au catalogue, et surtout <b>deux livres disparus</b> du décompte,
     * les tomes 1-2 de Bakuman ayant été fondus dans la plage 1-3. Un lot de
     * cinq livres compté cinq fois moins cher au tome donne un prix par tome
     * flatteur, donc un verdict d'achat trop favorable.
     *
     * <h2>La règle, volontairement timide</h2>
     * Le titre est découpé, chaque segment relu par les règles <b>déjà
     * écrites</b>, et la lecture multi-séries n'est retenue que si <b>au moins
     * deux</b> segments livrent chacun une série plausible <i>et</i> ses
     * propres tomes. Sinon on rend une liste vide et l'appelant reprend le
     * chemin d'avant, à l'identique.
     *
     * <p>Cette exigence de deux segments valides est ce qui rend le découpage
     * sans danger. Les séparateurs servent aussi <b>à l'intérieur</b> d'une
     * lecture normale - « tomes 1, 2, 4 » est une liste, « 1/5 » une plage,
     * « Jojo's Bizarre Adventure, Part 4 » un titre - mais aucun de ces cas ne
     * produit deux segments portant chacun une œuvre et des tomes. Ils
     * retombent donc tous sur le comportement existant.
     */
    private static List<RecognizedItem> plusieursSeries(String title) {
        if (title == null || title.isBlank()) {
            return List.of();
        }
        String[] segments = SEPARATEURS_DE_SERIES.split(title);
        if (segments.length < 2 || segments.length > MAX_SERIES * 2) {
            return List.of();
        }

        // Chaque segment est relu SEUL : ses tomes n'appartiennent qu'à lui,
        // ce qui est exactement ce que la lecture globale ne savait pas faire.
        List<RecognizedItem> propositions = new ArrayList<>();
        int seriesValides = 0;
        for (String segment : segments) {
            ListingTextParser.Detection lu = ListingTextParser.parse(segment, null);
            if (!lu.hasVolumes()) {
                continue;
            }
            String serie = ListingTextParser.probableSeriesTitle(segment);
            if (!estUnTitreDeSerie(serie)) {
                continue;
            }

            List<Integer> numeros = ListingTextParser.sorted(lu.volumeNumbers());
            String raison = evidence(numeros);
            for (Integer numero : numeros) {
                propositions.add(RecognizedItem.fromText(serie, numero, raison));
            }
            seriesValides++;
        }

        // Une seule série reconnue ne prouve pas qu'il y en avait plusieurs :
        // le séparateur jouait alors un autre rôle. On ne touche à rien.
        if (seriesValides < 2 || propositions.size() > MAX_ELEMENTS) {
            return List.of();
        }
        return List.copyOf(propositions);
    }

    /**
     * Le cas « l'annonce dit combien, pas lesquels ».
     *
     * <p>Aucune proposition n'est produite - il n'y a rien à cocher. Ce qui est
     * rapporté est ce que l'annonce affirme réellement : une taille, et une
     * série si le titre en nomme une. Si le titre ne désigne aucune œuvre
     * plausible (« lot de 9 mangas »), le nombre est conservé seul : il reste
     * vrai, et il servira à vérifier ce que l'utilisateur saisira.
     */
    private static TextReading nombreSeul(String title, Integer nombre) {
        String serie = ListingTextParser.probableSeriesTitle(title);
        return new TextReading(List.of(), nombre, estUnTitreDeSerie(serie) ? serie : null);
    }

    /**
     * Les mots qui restent souvent après nettoyage sans désigner d'œuvre.
     * {@code ListingTextParser.probableSeriesTitle} retire déjà « lot »,
     * « intégrale », les numéros et la ponctuation, mais pas le nom du support
     * ni les connecteurs isolés : « Lot mangas 1 à 10 » lui laisse
     * « mangas à ». Ce n'est pas un titre de série.
     */
    private static final java.util.Set<String> MOTS_SANS_OEUVRE = java.util.Set.of(
            "manga", "mangas", "livre", "livres", "bd", "bds", "tome", "tomes", "volume", "volumes",
            "serie", "série", "series", "séries", "collection", "edition", "édition", "editions", "éditions",
            "a", "à", "au", "aux", "de", "des", "du", "et", "en", "le", "la", "les", "un", "une");

    /**
     * Vrai si ce qui reste après nettoyage peut raisonnablement désigner une
     * œuvre. On exige au moins un mot qui ne soit ni un nom de support, ni un
     * connecteur, ni une abréviation d'état - sinon on préfère se taire et
     * laisser les photos ou la saisie manuelle répondre.
     */
    private static boolean estUnTitreDeSerie(String candidat) {
        if (candidat == null || candidat.isBlank()) {
            return false;
        }
        for (String mot : candidat.toLowerCase(java.util.Locale.ROOT).split("\\s+")) {
            String propre = mot.trim();
            if (propre.length() >= 2 && !MOTS_SANS_OEUVRE.contains(propre)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Une raison courte et lisible, sans recopier le texte de l'annonce : on
     * dit ce qui a été compris, pas ce qui a été lu mot pour mot.
     */
    private static String evidence(List<Integer> numeros) {
        if (numeros.size() == 1) {
            return "tome %d annoncé dans l'annonce".formatted(numeros.get(0));
        }
        int premier = numeros.get(0);
        int dernier = numeros.get(numeros.size() - 1);
        boolean continu = dernier - premier + 1 == numeros.size();
        return continu
                ? "tomes %d à %d annoncés dans l'annonce".formatted(premier, dernier)
                : "%d tomes annoncés dans l'annonce".formatted(numeros.size());
    }
}
