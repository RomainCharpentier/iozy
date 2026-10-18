-- V37__volume_search_cache_chain_version.sql
-- The version of the volume search chain (providers, parsing, naming rules)
-- that wrote each row. TomeSearchService serves a row only if it was written
-- by the current chain (TomeSearchService.CHAIN_VERSION) and less than 30
-- days ago; otherwise it reads the providers again. A change of chain is now a
-- bump of that constant, not a migration that empties the table (V33, V34).
--
-- Existing rows get 0: nothing says which chain wrote them, so each one is
-- read again the next time its series is opened.
ALTER TABLE volume_search_cache ADD COLUMN chain_version INT NOT NULL DEFAULT 0;
