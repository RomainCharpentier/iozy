-- Provenance d'un prix relevé.
--
-- La colonne `source` existait depuis V4 mais était écrite en dur à
-- 'MANUAL_ENTRY' et jamais relue : elle devient le champ d'origine réel, et
-- son nom rejoint celui du domaine. Les lignes existantes étaient toutes des
-- saisies manuelles - c'était le seul chemin de création - donc le renommage
-- n'invente rien.
ALTER TABLE market_price_observation RENAME COLUMN source TO origin;

-- Nombre de tomes réellement concernés. Fait autorité sur la plage : un lot
-- 1-4 + 7-10 compte 8 tomes, là où volume_range_start/end en diraient 10.
-- NULL pour les relevés antérieurs, qui retombent sur la plage.
ALTER TABLE market_price_observation ADD COLUMN volume_count integer;

-- Identité de l'annonce d'origine. Plusieurs relevés de même identité suivent
-- UNE offre dans le temps : ils ne comptent que pour un comparable. NULL pour
-- une saisie manuelle, qui n'a pas d'annonce derrière elle.
ALTER TABLE market_price_observation ADD COLUMN listing_identity varchar(512);
ALTER TABLE market_price_observation ADD COLUMN source_url text;

-- Retrouver les relevés d'une annonce donnée : c'est la lecture faite à chaque
-- analyse, pour la déduplication comme pour exclure l'annonce en cours.
CREATE INDEX idx_market_price_observation_listing_identity
    ON market_price_observation (listing_identity)
    WHERE listing_identity IS NOT NULL;

ALTER TABLE market_price_observation
    ADD CONSTRAINT market_price_observation_volume_count_positive
    CHECK (volume_count IS NULL OR volume_count > 0);
