-- V43__board_game_expansion_and_video_game_franchise_cache.sql
-- Lot 211: the expansions of a board game and the other games of a licence,
-- as optional elements of a work.
--
-- Both tables are shared reference data read from a provider, like
-- volume_search_cache: not private to an account (no owner_id), and nothing
-- in them is a copy or a wish. What the collector owns stays in entity,
-- variant and ownership; no existing row is moved.
-- A background job fills them in small batches and reads a row again once it
-- is old (fetched_at). A provider that does not answer writes nothing.

-- 1. The expansions of a board game on BoardGameGeek, keyed by the BGG id of
-- the base game. expansions: [{bggId, name, imageUrl, yearPublished}], in BGG
-- order; an empty array means BGG answered and knows no expansion.
CREATE TABLE board_game_expansion_cache (
    base_bgg_id  VARCHAR(32) PRIMARY KEY,
    expansions   JSONB NOT NULL,
    fetched_at   TIMESTAMPTZ NOT NULL
);

-- 2. The games of the licence of a video game on IGDB (its franchises and
-- collections), keyed by the IGDB id of the game. games: [{igdbId, name,
-- coverUrl, platforms: [...], releaseDate}]. The page keeps the ones on the
-- console of the copy. An empty array means IGDB answered and the game has no
-- licence.
CREATE TABLE video_game_franchise_cache (
    igdb_id         VARCHAR(32) PRIMARY KEY,
    franchise_name  VARCHAR(255),
    games           JSONB NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL
);
