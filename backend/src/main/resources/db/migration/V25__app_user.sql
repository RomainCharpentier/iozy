-- V25__app_user.sql
-- Les comptes. Jusqu'ici l'application n'en avait aucun : tout appartenait au
-- propriétaire par défaut (voir DefaultOwner, et V2 qui a posé les colonnes
-- owner_id « pour le jour où »). Ce jour est arrivé.
--
-- Le nom : `app_user` et non `user`, qui est un mot réservé du standard SQL
-- (et une fonction dans PostgreSQL) - une table ainsi nommée s'écrirait entre
-- guillemets pour toujours, dans chaque requête, y compris celles écrites plus
-- tard à la main.
--
-- Aucune ligne insérée ici. Le premier compte se crée par l'API, et REPREND
-- l'identifiant du propriétaire par défaut (voir AuthService) : les données
-- déjà en base lui appartiennent, sans qu'une seule ligne ne bouge. Un mot de
-- passe ne se fabrique pas en SQL - le hacher demanderait pgcrypto et
-- reviendrait à écrire un secret dans une migration versionnée.

CREATE TABLE app_user (
    id            UUID PRIMARY KEY,
    -- Rangé en minuscules par l'application avant écriture : deux comptes ne
    -- peuvent pas différer par la seule casse de leur adresse.
    email         VARCHAR(320)  NOT NULL UNIQUE,
    -- BCrypt rend 60 caractères ; la marge couvre un changement d'algorithme
    -- (Argon2 en rend davantage) sans nouvelle migration.
    password_hash VARCHAR(255)  NOT NULL,
    display_name  VARCHAR(80)   NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Pas de clé étrangère depuis les colonnes owner_id existantes : elles
-- portent aujourd'hui le propriétaire par défaut, et une contrainte posée
-- maintenant refuserait toute écriture tant que le premier compte n'existe
-- pas. Elle sera posée avec l'isolation par propriétaire, une fois les
-- lignes rattachées à de vrais comptes.
