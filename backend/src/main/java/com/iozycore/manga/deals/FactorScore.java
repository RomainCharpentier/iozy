package com.iozycore.manga.deals;

import com.iozycore.insights.ConfidenceLevel;

/**
 * The score (0-100) computed for a single {@link VerdictFactor}, always
 * carrying a human-readable rationale and a confidence level - a bare
 * number is never surfaced to the user without both, per the constraint
 * that an estimate must never be presented as a certainty.
 */
public record FactorScore(int score, String rationale, ConfidenceLevel confidence) {
    public FactorScore {
        if (score < 0 || score > 100) {
            throw new IllegalArgumentException("A factor score must be between 0 and 100");
        }
    }
}
