package com.iozycore.core.application.insights;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Extension point of the core: what is worth, at the new price, what is owned
 * of a work - for a manga, the new price of the edition multiplied by the
 * owned volumes (Batch 133). The core adds up per universe, without knowing
 * the rule.
 */
public interface OwnedValueSource {

    List<OwnedValue> valeurs();

    /** A work, the new value of what is owned of it, and the number of valued units. */
    record OwnedValue(UUID entityId, BigDecimal valeur, long unites) {
    }
}
