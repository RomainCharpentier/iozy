-- V48__account_preferences.sql
-- Lot 218: the common profile. The preferences of an account, read by both
-- apps (IozyCore and IozyTest), so they follow the person from one browser to
-- another.
--
-- Private to each account: owner_id is the @TenantId column, one row at most.
-- Every column is nullable on purpose: NULL means "never chosen on the
-- account", and the client then keeps what this device already had. A default
-- written here would overwrite a choice made before the account knew it.
CREATE TABLE account_preferences (
    id                      UUID PRIMARY KEY,
    owner_id                UUID NOT NULL,
    accent                  VARCHAR(16) CHECK (accent IN ('AUTO', 'TERRACOTTA')),
    appearance              VARCHAR(16) CHECK (appearance IN ('SYSTEM', 'DARK', 'LIGHT')),
    -- The order of the title languages, disabled ones prefixed by "-":
    -- "FRENCH,ROMAJI,-ENGLISH". Checked by the domain (AccountPreferences).
    title_composition       VARCHAR(64),
    blindtest_sound_enabled BOOLEAN,
    blindtest_sound_volume  SMALLINT CHECK (blindtest_sound_volume BETWEEN 0 AND 100),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT account_preferences_one_per_owner UNIQUE (owner_id),
    -- The sound is one setting: on or off, and how loud. Never half of it.
    CONSTRAINT account_preferences_sound_whole
        CHECK ((blindtest_sound_enabled IS NULL) = (blindtest_sound_volume IS NULL))
);
