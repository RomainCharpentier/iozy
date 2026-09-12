-- V35__oeuvre_suivie.sql
-- « Suivi » : le troisième état d'une œuvre pour un collectionneur, à côté de
-- Possédé et Envie (retour utilisateur du 2026-09-11 : « c'est une trinité,
-- chaque état est unique »). Posséder dit ce qu'on a, vouloir ce qu'on
-- aimerait, suivre ce dont on attend les sorties - un état à la fois. Et
-- c'est l'œuvre suivie, elle seule, qui entre au calendrier des sorties.
--
-- Une table du CŒUR, pour tout type. Le manga garde son édition suivie
-- (followed_edition, V20), qui dit LAQUELLE de ses éditions on collectionne ;
-- suivre une édition marque aussi la série comme suivie ici.
CREATE TABLE followed_work (
    id           UUID PRIMARY KEY,
    entity_id    UUID NOT NULL REFERENCES entity(id),
    owner_id     UUID NOT NULL,
    followed_at  DATE NOT NULL,
    -- Une œuvre se suit ou non : jamais deux fois par le même compte.
    CONSTRAINT followed_work_unique_par_oeuvre UNIQUE (entity_id, owner_id)
);

-- Qui suivait déjà une édition suivait la série : l'état ne repart pas de
-- zéro le jour où il reçoit son nom.
INSERT INTO followed_work (id, entity_id, owner_id, followed_at)
SELECT gen_random_uuid(), entity_id, owner_id, followed_at FROM followed_edition;
