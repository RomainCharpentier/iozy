package com.iozycore.purchaseanalysis;

/** A user-facing warning (edition risk, missing reference data, low confidence...), always carrying its own confidence. */
public record Warning(WarningSeverity severity, String message, ConfidenceLevel confidence) {
    public Warning {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("A warning must have a message");
        }
    }
}
