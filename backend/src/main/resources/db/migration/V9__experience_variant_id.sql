-- V9__experience_variant_id.sql
-- Audit "on mélange tome et série" : une Experience ne référençait que la
-- série entière, sans moyen de distinguer "j'ai lu le tome 3" de "j'ai lu
-- le tome 4" - voir com.iozycore.domain.experience.Experience. Nullable :
-- une expérience peut toujours concerner la série entière, ou un type sans
-- notion de tome (jeu vidéo, jeu de société).
ALTER TABLE experience ADD COLUMN variant_id UUID REFERENCES variant(id);
