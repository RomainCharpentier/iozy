-- V45__calendar_subscription.sql
-- Lot 215: subscribe to the release calendar from Google Agenda or Apple
-- Calendrier, through a secret link.
--
-- The link is a capability URL: whoever holds the token reads the upcoming
-- releases of its owner, with no session. So:
--  * the token is random (32 bytes from a secure generator, url-safe base64),
--    never derived from the owner;
--  * token_hash (SHA-256, hex) is what the public lookup searches by. The token
--    itself is then compared in constant time, so the time an answer takes
--    says nothing about how close a guess was;
--  * revoking sets revoked_at: the row stops matching at once, and the next
--    subscription gets a new token. At most one active link per owner.
-- Private to each account: owner_id is the @TenantId column.
CREATE TABLE calendar_subscription (
    id          UUID PRIMARY KEY,
    owner_id    UUID NOT NULL,
    token       VARCHAR(128) NOT NULL UNIQUE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ
);

-- One active link per owner. Two "subscribe" clicks at the same moment
-- cannot leave two live links behind.
CREATE UNIQUE INDEX calendar_subscription_one_active
    ON calendar_subscription (owner_id) WHERE revoked_at IS NULL;
