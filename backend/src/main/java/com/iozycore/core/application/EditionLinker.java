package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;

import java.util.Optional;
import java.util.UUID;

/**
 * Point d'extension du cœur : un univers qui tient des ÉDITIONS DE RÉFÉRENCE
 * rattache un tome à la sienne.
 *
 * <p>Le cœur sait qu'un tome porte un nom d'édition (« Perfect Edition ») ;
 * il ne sait pas ce qu'est une édition. Le module manga, lui, la retrouve ou
 * la crée, et rend son identifiant - le tome y est relié par identifiant
 * seulement (voir Variant.mangaEditionId), jamais par la classe (Lot 133).
 */
public interface EditionLinker {

    /** L'identifiant de l'édition de cette œuvre qui porte ce nom, si cet univers en tient une. */
    Optional<UUID> editionIdPour(Entity oeuvre, String nomEdition);
}
