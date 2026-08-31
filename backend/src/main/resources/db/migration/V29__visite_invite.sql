-- V29__visite_invite.sql
-- « Portes ouvertes » : parcourir cette collection sans compte, en lecture seule.
--
-- La colonne vit dans share_settings et non dans une table à elle, parce que
-- c'est la MÊME question que le lien de partage - « qu'est-ce que j'expose de
-- mon espace, et à qui ? » - posée d'une autre façon. Le lien s'envoie à
-- quelqu'un et se révoque ; la visite est une porte laissée ouverte à qui
-- atteint l'instance. Deux tables auraient séparé deux réglages qui se lisent
-- ensemble, sur le même écran, et qu'on ferme pour les mêmes raisons.
--
-- Les deux restent INDÉPENDANTS : supprimer le lien ne referme pas la porte, et
-- ouvrir la porte ne crée aucun jeton (voir ShareSettings). C'est pour ça que
-- la colonne ne dépend pas de `token`.
--
-- FALSE par défaut, y compris sur les instances déjà en service : une migration
-- n'ouvre jamais un accès que personne n'a demandé. Sur une instance existante,
-- rien ne change tant que son propriétaire n'a pas coché la case.
ALTER TABLE share_settings ADD COLUMN open_to_guests BOOLEAN NOT NULL DEFAULT false;

-- Retrouver « la collection ouverte aux visiteurs » est la toute première
-- requête d'un visiteur anonyme, avant même d'avoir une session. Elle ne filtre
-- que sur ce booléen : l'index évite un balayage de table sur le seul chemin
-- que n'importe qui peut appeler sans compte.
CREATE INDEX idx_share_settings_open_to_guests ON share_settings (open_to_guests) WHERE open_to_guests;
