-- V21__wishlist_entry_variant.sql
-- « Je veux CE tome » - l'envie descend de l'œuvre vers l'élément réellement
-- collectionnable (voir l'étude produit du 2026-08-27, §1 et §16).
--
-- Pourquoi ce déplacement. Une envie posée sur une série ne veut rien dire dès
-- qu'on en possède la moitié : « veux-tu Naruto ? » n'a pas de réponse utile
-- quand il manque les tomes 42 à 72. L'état personnel appartient à l'objet
-- qu'on collectionne - le tome pour un manga.
--
-- variant_id reste NULLABLE, et ce n'est pas un compromis : pour un type sans
-- notion de tome (jeu vidéo, jeu de société), l'œuvre EST l'objet
-- collectionnable, et sa possession se pose déjà au niveau de l'Entity (voir
-- Ownership.variantId, nullable pour la même raison). La règle générale est
-- « l'envie porte sur l'objet individuel du type », pas « l'envie porte
-- toujours sur un tome ».
ALTER TABLE wishlist_entry ADD COLUMN variant_id UUID REFERENCES variant(id) ON DELETE CASCADE;

-- Les envies existantes portent sur des séries et n'ont pas d'équivalent dans
-- le nouveau modèle : les convertir demanderait d'inventer, pour chaque série,
-- une envie sur chacun de ses tomes manquants - soixante-neuf lignes pour le
-- seul Naruto, qu'aucun utilisateur n'a jamais saisies. Décision utilisateur
-- du 2026-08-27 : repartir propre. Deux entrées perdues, recréables en deux
-- clics sur les tomes réellement voulus.
DELETE FROM wishlist_entry
WHERE entity_id IN (SELECT id FROM entity WHERE entity_type_id IN (SELECT id FROM entity_type WHERE code = 'MANGA'));

-- L'unicité descend au même niveau que l'envie. Deux index plutôt qu'une
-- contrainte unique sur (entity_id, variant_id) : en SQL, deux NULL ne sont
-- jamais « égaux », si bien qu'une contrainte ordinaire laisserait créer
-- autant d'envies d'œuvre qu'on le voudrait sur la même Entity - exactement
-- le doublon qu'on cherche à interdire.
ALTER TABLE wishlist_entry DROP CONSTRAINT IF EXISTS wishlist_entry_entity_id_key;

CREATE UNIQUE INDEX wishlist_entry_unique_tome
    ON wishlist_entry (entity_id, variant_id)
    WHERE variant_id IS NOT NULL;

CREATE UNIQUE INDEX wishlist_entry_unique_oeuvre
    ON wishlist_entry (entity_id)
    WHERE variant_id IS NULL;

CREATE INDEX idx_wishlist_entry_variant_id ON wishlist_entry (variant_id);
