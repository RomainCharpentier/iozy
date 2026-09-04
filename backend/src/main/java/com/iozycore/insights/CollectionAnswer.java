package com.iozycore.insights;

import com.iozycore.purchaseanalysis.ConfidenceLevel;

import java.util.List;
import java.util.UUID;

/**
 * La reponse d'une IA a une question posee sur SA collection.
 *
 * <p>{@code oeuvres} sont les fiches sur lesquelles la reponse s'appuie -
 * verifiees par le service contre l'instantane envoye : un identifiant que
 * le modele aurait invente n'arrive jamais ici. C'est ce qui rend la reponse
 * verifiable d'un clic, et c'est la seule garantie qu'on donne : le texte,
 * lui, reste celui d'un modele, et l'ecran le dit.
 */
public record CollectionAnswer(String reponse, List<Reference> oeuvres, ConfidenceLevel confiance, String modele) {

    public record Reference(UUID id, String titre) {
    }
}
