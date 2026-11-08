-- V41__release_refresh_run_outcome.sql
-- How each pass of the release refresh ended. Before this column, a pass
-- that did not start (another one running) or that hung left no row, and the
-- status line could only guess from stopped_on_provider and error.
--   COMPLETED        every provider answered
--   PARTIAL          a provider was silent, but some series were re-read
--   PROVIDER_SILENT  a provider was silent and nothing was re-read
--   FAILED           a source threw an unexpected error
--   SKIPPED          the pass did not start: another one was running
--   TIMED_OUT        the pass ran too long and was given up
-- The origin column also takes CATCH_UP from now on: a pass started after a
-- missed night (the machine was off at 04:30).
ALTER TABLE release_refresh_run ADD COLUMN outcome VARCHAR(16);

UPDATE release_refresh_run SET outcome = CASE
    WHEN error IS NOT NULL THEN 'FAILED'
    WHEN NOT stopped_on_provider THEN 'COMPLETED'
    WHEN refreshed_count > 0 THEN 'PARTIAL'
    ELSE 'PROVIDER_SILENT'
END;

ALTER TABLE release_refresh_run ALTER COLUMN outcome SET NOT NULL;
