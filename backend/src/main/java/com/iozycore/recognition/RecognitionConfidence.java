package com.iozycore.recognition;

/**
 * À quel point IozyCore croit à ce qu'il propose sur une photo.
 *
 * <h2>Trois niveaux, pas un pourcentage</h2>
 * Aucun moteur de reconnaissance branché ici n'est <b>calibré</b> : un modèle
 * qui annonce « 97,36 % » dit sa propre assurance, pas sa justesse mesurée.
 * Afficher ce nombre donnerait à l'utilisateur une précision que personne n'a
 * vérifiée. Trois niveaux nommés se lisent pour ce qu'ils sont - un tri, pas
 * une mesure - et restent honnêtes tant que le système ne l'est pas.
 *
 * <h2>Aucun niveau n'autorise une écriture automatique</h2>
 * Même {@link #HIGH} reste une proposition à confirmer. La différence entre
 * les niveaux est ce que l'écran met en avant, jamais le droit d'écrire seul
 * dans le catalogue ou la collection.
 */
public enum RecognitionConfidence {

    /** Titre et numéro de tome lisibles, ou identifiant exact (EAN) reconnu. */
    HIGH,

    /** L'un des deux est lisible, l'autre déduit du contexte du lot. */
    MEDIUM,

    /** Une piste, pas une identification - à ne jamais pré-cocher à l'écran. */
    LOW;

    /**
     * Vrai si la proposition mérite d'être pré-sélectionnée à l'écran. Ce n'est
     * pas un droit d'écriture : l'utilisateur confirme toujours.
     */
    public boolean worthPreselecting() {
        return this == HIGH;
    }

    /** Le plus prudent des deux - sert quand deux photos se contredisent. */
    public RecognitionConfidence lowerOf(RecognitionConfidence other) {
        if (other == null) {
            return this;
        }
        return compareTo(other) >= 0 ? this : other;
    }

    /** Le plus confiant des deux - sert quand deux photos se confortent. */
    public RecognitionConfidence higherOf(RecognitionConfidence other) {
        if (other == null) {
            return this;
        }
        return compareTo(other) <= 0 ? this : other;
    }
}
