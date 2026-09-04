package com.iozycore.insights;

import java.util.Optional;

/**
 * Le port vers un modele capable de repondre a une question en francais a
 * partir d'un instantane de la collection - meme convention que
 * {@code AiEditionAdvisor} : l'adaptateur ne persiste rien, et une reponse
 * absente n'est jamais une erreur remontee a l'utilisateur, seulement une
 * capacite eteinte ou un appel qui a echoue.
 */
public interface AiCollectionOracle {

    /** Faux quand aucune cle n'est configuree : la fonctionnalite est alors simplement absente. */
    boolean estConfigure();

    /**
     * @param instantane la collection, en JSON compact (voir CollectionQuestionService)
     * @param question   la question telle que tapee
     * @return le texte brut du modele (un JSON), vide si l'appel a echoue
     */
    Optional<String> repondre(String instantane, String question);
}
