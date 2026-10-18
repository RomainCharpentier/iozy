-- V23__ai_price_estimate_cache.sql
-- Mémorise durablement la RÉPONSE de l'IA à « combien vaut un tome de cette
-- édition dans cet état » (voir AiMarketPriceAdvisor). Même raison d'être que
-- volume_search_cache (V3) : un appel externe sur un chemin répété se
-- mémorise, sinon le quota n'y survit pas. Le fournisseur est Gemini, sur son
-- palier gratuit - c'est un choix explicite de l'utilisateur, qui ne veut pas
-- payer pour son usage personnel.
--
-- price_per_volume NULL n'est PAS une absence de réponse : c'est le modèle qui
-- répond « je ne sais pas », ce que l'invite lui demande explicitement de faire
-- plutôt que d'inventer un chiffre plausible. C'est même la réponse la plus
-- stable qui soit, donc la plus utile à mémoriser. Un ÉCHEC (clé absente,
-- quota dépassé, réseau) n'arrive jamais ici : rien n'est écrit, et l'appel
-- sera retenté.
CREATE TABLE ai_price_estimate_cache (
    id                UUID PRIMARY KEY,
    -- Série/édition normalisées (trim + minuscules) : clés de cache, jamais
    -- affichées telles quelles.
    series_title      VARCHAR(512) NOT NULL,
    edition_name      VARCHAR(512) NOT NULL DEFAULT '',
    item_condition    VARCHAR(32)  NOT NULL,
    price_per_volume  NUMERIC(10,2),
    confidence        VARCHAR(16)  NOT NULL,
    rationale         TEXT,
    fetched_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (series_title, edition_name, item_condition)
);
