-- V4__purchase_analysis.sql
-- Purchase Analysis feature - see com.iozycore.purchaseanalysis. Additive
-- only: no existing table is touched, this module only ever READS
-- catalog/ownership through their existing repositories.

-- Reference data for one French edition of one series, enriched
-- progressively by the user the first time an analysis references an
-- edition unknown to the system (see PurchaseAnalysisService) - never
-- fetched from an external API (see PurchaseAnalysisEngine for why).
-- total_volumes/retail_price_new_per_volume stay NULL when genuinely
-- unknown, never defaulted to 0/zero.
CREATE TABLE manga_edition (
    id                              UUID PRIMARY KEY,
    series_title                    VARCHAR(512) NOT NULL,
    edition_name                    VARCHAR(255) NOT NULL,
    edition_tier                    VARCHAR(32) NOT NULL,
    publisher                       VARCHAR(255),
    total_volumes                   INTEGER,
    retail_price_new_per_volume     NUMERIC(19,2),
    out_of_print                    BOOLEAN NOT NULL DEFAULT false,
    better_edition_announced        BOOLEAN NOT NULL DEFAULT false,
    better_edition_note             TEXT,
    language_code                   VARCHAR(8) NOT NULL DEFAULT 'fr',
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Case-sensitive at the database level (a known Phase 1 limitation) -
    -- lookups themselves are case-insensitive (see MangaEditionRepository),
    -- so this only risks a rare accidental duplicate on inconsistent casing,
    -- never a failed lookup.
    UNIQUE (series_title, edition_name)
);

-- Append-only log of real, manually-entered price observations - the ONLY
-- source of "observed market" prices in Phase 1, since no viable public
-- API exists for Vinted/Leboncoin/Rakuten (see PurchaseAnalysisEngine).
-- volume_range_start/end are both NULL when the observation covers the
-- whole edition/lot rather than a specific volume range.
CREATE TABLE market_price_observation (
    id                  UUID PRIMARY KEY,
    manga_edition_id    UUID NOT NULL REFERENCES manga_edition(id),
    volume_range_start  INTEGER,
    volume_range_end    INTEGER,
    observed_price      NUMERIC(19,2) NOT NULL,
    platform            VARCHAR(32) NOT NULL,
    observed_condition  VARCHAR(32),
    observed_at         DATE NOT NULL,
    note                TEXT,
    source              VARCHAR(32) NOT NULL DEFAULT 'MANUAL_ENTRY',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per "ANALYZE LOT" click - result_payload is the full serialized
-- PurchaseAnalysis (same JSONB-snapshot pattern as volume_search_cache.volumes),
-- the other columns are only an indexed projection for the history list.
CREATE TABLE purchase_analysis (
    id                      UUID PRIMARY KEY,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    listing_url             VARCHAR(2048),
    listing_platform        VARCHAR(32),
    listing_title           VARCHAR(512),
    asking_price            NUMERIC(19,2),
    shipping_fee            NUMERIC(19,2),
    buyer_protection_fee    NUMERIC(19,2),
    total_real_cost         NUMERIC(19,2),
    listing_condition       VARCHAR(32),
    verdict                 VARCHAR(32),
    verdict_score           INTEGER,
    recommended_offer       NUMERIC(19,2),
    target_price_min        NUMERIC(19,2),
    target_price_max        NUMERIC(19,2),
    max_price               NUMERIC(19,2),
    negotiation_advice      VARCHAR(32),
    result_payload          JSONB NOT NULL
);

-- Single mono-user row (see DefaultOwner) - PATCH /api/purchase-analysis/preferences
-- upserts this row, GET falls back to CollectorPreferences.defaults() before it exists.
CREATE TABLE collector_preferences (
    owner_id                                                UUID PRIMARY KEY,
    prefer_completed_series                                 BOOLEAN NOT NULL DEFAULT true,
    avoid_ongoing_series                                     BOOLEAN NOT NULL DEFAULT true,
    prefer_omnibus_integral                                 BOOLEAN NOT NULL DEFAULT true,
    edition_tier_ranking                                    JSONB NOT NULL DEFAULT '[]'::JSONB,
    avoid_outdated_edition_when_better_exists_or_announced  BOOLEAN NOT NULL DEFAULT true,
    french_language_only                                    BOOLEAN NOT NULL DEFAULT true,
    prefer_easy_to_complete_collections                     BOOLEAN NOT NULL DEFAULT true,
    condition_importance                                    VARCHAR(16) NOT NULL DEFAULT 'HIGH',
    minimum_discount_vs_retail_percent                      INTEGER NOT NULL DEFAULT 20,
    factor_weights                                          JSONB NOT NULL DEFAULT '{}'::JSONB
);
