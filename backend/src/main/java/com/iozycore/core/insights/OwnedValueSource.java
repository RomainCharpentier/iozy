package com.iozycore.core.insights;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Point d'extension du cœur : ce que vaut, au prix du neuf, ce qu'on possède
 * d'une œuvre - pour un manga, le prix neuf de l'édition multiplié par les
 * tomes possédés (Lot 133). Le cœur additionne par univers, sans connaître
 * la règle.
 */
public interface OwnedValueSource {

    List<OwnedValue> valeurs();

    /** Une œuvre, la valeur neuve de ce qu'on en possède, et le nombre d'unités valorisées. */
    record OwnedValue(UUID entityId, BigDecimal valeur, long unites) {
    }
}
