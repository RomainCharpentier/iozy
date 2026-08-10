-- V5__loan.sql
-- Prêts : à qui un manga ou un jeu a été prêté (voir com.iozycore.domain.loan).
-- Rattaché à une Ownership précise (pas à l'Entity) : si plusieurs
-- exemplaires du même tome sont possédés, seul celui réellement prêté doit
-- apparaître emprunté.
CREATE TABLE loan (
    id              UUID PRIMARY KEY,
    ownership_id    UUID NOT NULL REFERENCES ownership(id),
    owner_id        UUID NOT NULL,
    borrower_name   VARCHAR(255) NOT NULL,
    lent_at         DATE NOT NULL,
    returned_at     DATE,
    note            TEXT
);
