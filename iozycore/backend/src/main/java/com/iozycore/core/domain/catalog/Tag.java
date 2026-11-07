package com.iozycore.core.domain.catalog;

import java.util.UUID;

public record Tag(UUID id, String label) {

    /** Same bound as the tag.label column (VARCHAR(128)). */
    public static final int MAX_LABEL_LENGTH = 128;

    public Tag {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Le label d'un Tag ne peut pas être vide");
        }
        if (label.length() > MAX_LABEL_LENGTH) {
            throw new IllegalArgumentException(
                    "Le libellé d'un tag ne peut pas dépasser " + MAX_LABEL_LENGTH + " caractères.");
        }
    }
}
