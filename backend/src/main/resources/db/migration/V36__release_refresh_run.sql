-- V36__release_refresh_run.sql
-- One row per pass of the release refresh (the night job, or a manual launch).
-- It lets the app say when the calendar was last refreshed and, in local mode
-- where the machine may be off at night, lets the user start a pass by hand.
-- A table of the CORE, common to all accounts: the refresh reads the shared
-- catalog, not a collection, so there is no owner_id here.
CREATE TABLE release_refresh_run (
    id                   UUID PRIMARY KEY,
    started_at           TIMESTAMPTZ NOT NULL,
    finished_at          TIMESTAMPTZ NOT NULL,
    -- SCHEDULED (the night job) or MANUAL (a launch from the screen).
    origin               VARCHAR(16) NOT NULL,
    -- Series that were due for a re-read at the start of the pass...
    stale_count          INT NOT NULL,
    -- ...and how many of them were re-read (the pass is capped per run).
    refreshed_count      INT NOT NULL,
    -- A silent provider (quota, outage) stopped the pass early.
    stopped_on_provider  BOOLEAN NOT NULL,
    -- Set when the pass failed with an unexpected error; null otherwise.
    error                VARCHAR(500)
);

CREATE INDEX release_refresh_run_started_at_idx ON release_refresh_run (started_at DESC);
