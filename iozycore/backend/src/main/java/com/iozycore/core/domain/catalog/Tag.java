package com.iozycore.core.domain.catalog;

import java.util.UUID;

public record Tag(UUID id, String label) {
    public Tag {
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Le label d'un Tag ne peut pas être vide");
        }
    }
}
