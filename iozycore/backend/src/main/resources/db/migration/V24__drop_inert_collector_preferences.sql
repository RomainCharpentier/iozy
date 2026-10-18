-- V24__drop_inert_collector_preferences.sql
-- Cinq préférences de collectionneur n'étaient lues par AUCUNE ligne du moteur
-- (comptage au Lot 73 ; c'est déjà ce qui avait fait abandonner l'écran de
-- réglages au Lot 30). Elles étaient pourtant persistées, validées par l'API et
-- rendues par GET /preferences : une surface de configuration qui promettait
-- cinq leviers inertes.
--
-- Décision de l'utilisateur (2026-08-29) : les retirer plutôt qu'inventer cinq
-- règles de score qui n'existaient nulle part.
--
-- Ce qui RESTE est exactement ce que le moteur lit : la hiérarchie des gammes
-- d'édition, l'évitement d'une édition dépassée, l'importance de l'état, la
-- décote minimale attendue et les poids des dix facteurs.
ALTER TABLE collector_preferences
    DROP COLUMN prefer_completed_series,
    DROP COLUMN avoid_ongoing_series,
    DROP COLUMN prefer_omnibus_integral,
    DROP COLUMN french_language_only,
    DROP COLUMN prefer_easy_to_complete_collections;
