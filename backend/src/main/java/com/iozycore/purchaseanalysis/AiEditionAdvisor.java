package com.iozycore.purchaseanalysis;

import com.iozycore.domain.catalog.MangaEdition;
import com.iozycore.domain.catalog.MangaEditionRepository;

import java.util.Optional;

/**
 * Port for an LLM-backed best-effort draft of a {@link MangaEdition}'s
 * reference data, to spare the user filling in total volumes/publisher/
 * retail price by hand for every new edition. Same self-disabling contract
 * as every other external metadata provider in this codebase (BGG/IGDB/
 * Google Books): no configured key means an always-empty result, never an
 * exception surfacing to the caller.
 * <p>
 * Guardrail (approved direction, see project memory): a suggestion from
 * this port is display-only until the user explicitly reviews and submits
 * it through the existing {@code POST /editions} / {@code PATCH /editions/
 * {id}} endpoints - implementations must never write to
 * {@link MangaEditionRepository} themselves.
 */
public interface AiEditionAdvisor {

    /** Empty when no AI provider is configured, or it could not produce a usable answer - never throws. */
    Optional<EditionSuggestion> suggestReferenceData(String seriesTitle, String editionName);
}
