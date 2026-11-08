-- V42__work_collector_status_and_ownership_created_at.sql
-- Lot 209: one read model for a work and its elements (volumes of a series,
-- games, expansions), for every type.

-- 1. The collector status of a work: ongoing (default), paused or dropped.
-- A paused or dropped work keeps its elements listed, but its missing elements
-- are no longer counted. Private to each account, like a wish: owner_id is the
-- @TenantId column. No row means ONGOING.
-- The status means nothing without its work: it goes with the work (CASCADE),
-- and it is never a reason to refuse the deletion of a work.
CREATE TABLE work_collector_status (
    id          UUID PRIMARY KEY,
    entity_id   UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    owner_id    UUID NOT NULL,
    status      VARCHAR(16) NOT NULL CHECK (status IN ('ONGOING', 'PAUSED', 'DROPPED')),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT work_collector_status_one_per_work UNIQUE (entity_id, owner_id)
);

-- 2. When an ownership row was created. acquired_at is the purchase date the
-- collector types (it can be years ago); "added this month" needs the day the
-- object entered the app.
ALTER TABLE ownership ADD COLUMN created_at TIMESTAMPTZ;

-- Backfill of the rows that exist today. Two lower bounds are known:
--  * the row cannot be older than its work in the catalog (entity.created_at);
--  * quick add writes acquired_at = the day of the addition unless the
--    collector typed an older purchase date.
-- The latest of the two is the closest honest value. A back-dated purchase on
-- an old work stays old, so it is never counted as an addition of this month
-- by mistake; a work added together with its first copy gets the real moment
-- of that addition.
UPDATE ownership o
SET created_at = GREATEST(o.acquired_at::timestamptz, COALESCE(e.created_at, o.acquired_at::timestamptz))
FROM entity e
WHERE e.id = o.entity_id;

UPDATE ownership SET created_at = acquired_at::timestamptz WHERE created_at IS NULL;

ALTER TABLE ownership ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE ownership ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX ownership_owner_created_at ON ownership (owner_id, created_at);
