package com.iozycore.manga.recognition;

/**
 * D'où vient une proposition. Un même élément peut être soutenu par plusieurs
 * sources à la fois - c'est même le cas le plus utile.
 *
 * <h2>Pourquoi une dimension séparée de la confiance</h2>
 * Il serait tentant d'ajouter un niveau {@code DETERMINISTIC} à
 * {@link RecognitionConfidence}. Ce serait empiler deux questions différentes
 * dans une seule échelle :
 * <ul>
 *   <li>{@link RecognitionConfidence} répond à « à quel point suis-je sûr de ce
 *       que j'ai lu ? » ;</li>
 *   <li>{@code RecognitionSource} répond à « <b>comment</b> l'ai-je lu ? ».</li>
 * </ul>
 * Les garder distinctes permet de dire « le titre annonce les tomes 1 à 14 »
 * (lecture certaine, source déclarative) sans laisser croire que le vendeur a
 * <b>forcément</b> ces quatorze tomes en main. Le texte dit ce qu'il dit ;
 * l'extraction est sûre, le contenu réel ne l'est pas.
 *
 * <h2>L'ordre compte</h2>
 * Voir {@link #priority()} : il départage deux sources qui décrivent la même
 * chose, sans jamais servir à en effacer une qui décrit <b>autre chose</b>.
 * Un texte qui donne le numéro et une photo qui donne l'édition ne
 * s'affrontent pas, ils se complètent.
 */
public enum RecognitionSource {

    /**
     * Lu dans le titre ou la description, par des règles écrites - local,
     * gratuit, immédiat, reproductible. Voir
     * {@code ListingTextParser} : « tomes 1 à 14 » donne 1..14 parce que la
     * phrase le dit, pas parce qu'un score l'estime.
     */
    TEXT,

    /** Lu sur une photo par un moteur de reconnaissance. */
    VISION,

    /**
     * Confirmé par un identifiant exact (EAN/ISBN). Un code-barres correspond
     * ou ne correspond pas ; il ne « ressemble » pas.
     * <p>
     * <b>Limite actuelle</b> : aucun décodeur ne lit encore un code-barres
     * depuis les pixels. Cette source n'apparaît donc que lorsqu'un moteur
     * vision a su lire les chiffres imprimés. Le jour où un décodeur local
     * existe, il alimente le même champ.
     */
    EAN;

    /**
     * Qui l'emporte quand deux sources décrivent <b>la même dimension</b> de
     * façon incompatible. Plus haut = prioritaire.
     * <p>
     * La correction de l'utilisateur n'est pas dans cette échelle : elle vit
     * au-dessus de tout, et l'écran s'en charge - une valeur saisie à la main
     * n'est jamais recalculée.
     */
    public int priority() {
        return switch (this) {
            case EAN -> 3;
            case TEXT -> 2;
            case VISION -> 1;
        };
    }

    /** Le libellé montré à l'utilisateur - jamais le nom du fournisseur d'IA. */
    public String label() {
        return switch (this) {
            case TEXT -> "annonce";
            case VISION -> "photos";
            case EAN -> "code-barres";
        };
    }
}
