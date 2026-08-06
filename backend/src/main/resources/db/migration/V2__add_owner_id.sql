-- V2__add_owner_id.sql
-- Prépare le passage au multi-utilisateur (conception : évolutions futures,
-- option B) sans le construire maintenant. ownership/experience/wishlist_entry
-- sont les 3 agrégats privés par utilisateur (le Catalog reste partagé) -
-- voir DefaultOwner.java pour le choix de NOT NULL + valeur par défaut
-- plutôt qu'une colonne nullable.

ALTER TABLE ownership
    ADD COLUMN owner_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE experience
    ADD COLUMN owner_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE wishlist_entry
    ADD COLUMN owner_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

CREATE INDEX idx_ownership_owner_id ON ownership(owner_id);
CREATE INDEX idx_experience_owner_id ON experience(owner_id);
CREATE INDEX idx_wishlist_entry_owner_id ON wishlist_entry(owner_id);
