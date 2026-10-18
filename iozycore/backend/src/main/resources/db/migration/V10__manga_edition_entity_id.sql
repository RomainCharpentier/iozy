-- Modèle manga cible (Série -> Édition -> Tome) : lie chaque édition à sa
-- Série catalogue quand elle est connue. Nullable et additive - une édition
-- créée avant/sans Entity correspondante (ex: analyse d'achat d'une série
-- pas encore en collection) reste parfaitement valide sans ce lien.
ALTER TABLE manga_edition ADD COLUMN entity_id UUID REFERENCES entity(id);
CREATE INDEX idx_manga_edition_entity_id ON manga_edition(entity_id);
