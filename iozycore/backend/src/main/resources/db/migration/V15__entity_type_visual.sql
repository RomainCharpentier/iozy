-- V15__entity_type_visual.sql
-- Identité visuelle d'un type de collection (voir
-- com.iozycore.domain.catalog.EntityType) : un type créé par l'utilisateur
-- prenait jusqu'ici le visuel de repli du client, sans moyen de le choisir,
-- alors que les 4 univers connus ont chacun le leur.
--
-- Des CLÉS, pas des valeurs de rendu ("terracotta"/"vinyl", jamais "#c05a3c") :
-- le client seul sait traduire une clé en couleur, et lui seul sait l'adapter
-- au thème clair/sombre. Stocker un code couleur ici figerait une teinte
-- calibrée pour un seul des deux thèmes.
--
-- Strictement additif : NULL = visuel par défaut, aucune ligne existante
-- touchée.
ALTER TABLE entity_type ADD COLUMN color_key VARCHAR(32);
ALTER TABLE entity_type ADD COLUMN icon_key VARCHAR(32);
