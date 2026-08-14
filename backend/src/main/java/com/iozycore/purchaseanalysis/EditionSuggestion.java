package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.EditionTier;
import com.iozycore.domain.catalog.MangaEdition;

import java.math.BigDecimal;

/**
 * AI-drafted reference data for a {@link MangaEdition} unknown to the
 * system yet - a proposal to review and correct, never persisted
 * automatically (see {@link AiEditionAdvisor}). Mirrors the fields of
 * {@code PurchaseAnalysisController.CreateMangaEditionRequest} so the web
 * client can pre-fill that exact form, plus a mandatory {@code confidence}
 * and human-readable {@code rationale} - never a raw AI-sourced figure
 * without a stated trust level, same rule already applied to every
 * factor in {@link VerdictScorer}.
 */
public record EditionSuggestion(EditionTier tier, String publisher, Integer totalVolumes,
                                 BigDecimal retailPriceNewPerVolume, Boolean outOfPrint,
                                 Boolean betterEditionAnnounced, String betterEditionNote,
                                 ConfidenceLevel confidence, String rationale) {
}
