-- V26__owner_id_partout.sql
-- Les trois tables privées qui n'avaient pas encore de propriétaire.
--
-- La V2 avait posé `owner_id` sur les trois agrégats privés de l'époque
-- (ownership, experience, wishlist_entry), et les migrations suivantes ont
-- suivi la convention (tier_list, entity_rank, followed_edition,
-- collector_preferences, share_settings). Trois l'ont manquée, parce qu'elles
-- sont arrivées à un moment où la question ne se posait pas :
--
--   - `purchase_analysis` : MES analyses d'annonces, avec les prix que j'ai
--     saisis et la collection à laquelle elles se comparent ;
--   - `market_price_observation` : MES prix relevés - toute l'application les
--     présente comme tels (« tes prix relevés sur des lots de même forme ») ;
--   - `tier_list_item` : l'appartenance d'une œuvre à un classement. La
--     colonne est redondante avec celle de `tier_list`, et c'est délibéré :
--     sans elle, « dans quels classements se trouve cette œuvre ? » -
--     une vraie requête de l'application - devrait se souvenir de passer par
--     la liste parente pour ne pas répondre sur celles des autres.
--
-- Ce qui reste PARTAGÉ, et pourquoi :
--   - le catalogue (entity, variant, tag, relationship) : une œuvre est la
--     même pour tout le monde, c'est le parti pris depuis la V2 ;
--   - `manga_edition` : les éditions de référence sont de la donnée d'univers,
--     enrichie collectivement - c'est elle qui rend tous les « X/Y » possibles ;
--   - `volume_search_cache` et `ai_price_estimate_cache` : des caches devant
--     des fournisseurs externes à quota. Les cloisonner ferait payer deux fois
--     le même appel pour la même question.
--
-- Les lignes existantes reviennent au propriétaire par défaut, celui que le
-- premier compte adopte (voir V25 et AppUser.premier).

ALTER TABLE purchase_analysis
    ADD COLUMN owner_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE market_price_observation
    ADD COLUMN owner_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE tier_list_item
    ADD COLUMN owner_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

CREATE INDEX idx_purchase_analysis_owner_id ON purchase_analysis(owner_id);
CREATE INDEX idx_market_price_observation_owner_id ON market_price_observation(owner_id);
CREATE INDEX idx_tier_list_item_owner_id ON tier_list_item(owner_id);
