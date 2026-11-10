-- V47__share_page.sql
-- Lot 217: the "Partager" page.
--
-- 1. The value of the collection on the public page, an opt-in. Off for every
--    existing link: a link already handed out shows nothing more than before.
--    Even when on, the value only comes out when it rests on enough prices
--    (see ValueDisclosure).
ALTER TABLE share_settings ADD COLUMN show_value BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. "Mes 4 incontournables": up to four works the owner puts first on the
--    public page, in order. Private to each account: owner_id is the
--    @TenantId column. A work removed from the catalog leaves the list with it.
CREATE TABLE share_pin (
    id        UUID PRIMARY KEY,
    owner_id  UUID NOT NULL,
    entity_id UUID NOT NULL REFERENCES entity (id) ON DELETE CASCADE,
    position  SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 3),
    CONSTRAINT share_pin_one_place UNIQUE (owner_id, position),
    CONSTRAINT share_pin_once UNIQUE (owner_id, entity_id)
);

-- 3. The gift list: a second public link that shows the wishes only, and
--    expires 30 days after it was issued or last renewed. The existing share
--    link (share_settings.token) does not expire and is not touched.
--
--    Like the calendar link (V45), the token is a capability URL: 32 random
--    bytes, looked up by its SHA-256 hash then compared in constant time.
--    One link per owner; deleting it removes the row, and the next one gets a
--    new token. An expired row is kept so the page can say "Ce lien a expiré"
--    instead of "not found".
CREATE TABLE gift_link (
    id          UUID PRIMARY KEY,
    owner_id    UUID NOT NULL,
    token       VARCHAR(128) NOT NULL UNIQUE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL,
    CONSTRAINT gift_link_one_per_owner UNIQUE (owner_id)
);
