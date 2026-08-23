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
        ListingTextParser.Detection detection = ListingTextParser.parse(title, description);

        // Ni numéros lisibles, ni formulation exploitable : on se tait, et les
        // photos ou la saisie manuelle prennent le relais.
        if (!detection.hasVolumes()) {
            return List.of();
        }

        String serie = ListingTextParser.probableSeriesTitle(title);
        if (!estUnTitreDeSerie(serie)) {
            // Des numéros sans œuvre identifiable ne font pas des propositions :
            // « lot mangas 1 à 10 » ne dit pas DE QUOI il s'agit, et dix lignes
            // « mangas · tome N » n'aideraient personne - elles nuiraient même,
            // en fabriquant une série qui n'existe pas.
            return List.of();
        }

        List<Integer> numeros = ListingTextParser.sorted(detection.volumeNumbers());
        if (numeros.size() > MAX_ELEMENTS) {
            return List.of();
        }

        String raison = evidence(numeros);
        List<RecognizedItem> propositions = new ArrayList<>(numeros.size());
        for (Integer numero : numeros) {
            // Pas d'édition : le parser n'en lit pas, et en supposer une serait
            // exactement ce que ce projet refuse. Les photos ou l'utilisateur
            // la compléteront.
            propositions.add(RecognizedItem.fromText(serie, numero, raison));
        }
        return List.copyOf(propositions);
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
