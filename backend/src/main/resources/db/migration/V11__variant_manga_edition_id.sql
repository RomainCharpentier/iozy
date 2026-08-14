-- Modèle manga cible (Série -> Édition -> Tome) : lie chaque Tome à son
-- Édition catalogue quand elle est connue. Nullable et additive - l'attribut
-- libre attributes.edition (texte, résolu par SeriesMatcher / groupVariantsByEdition
-- côté web) reste en place tel quel comme mécanisme de repli ; cette colonne est
-- la relation structurée cible, peuplée seulement une fois réellement résolue
-- (voir Entity.linkVariantToEdition), jamais devinée.
ALTER TABLE variant ADD COLUMN manga_edition_id UUID REFERENCES manga_edition(id);
CREATE INDEX idx_variant_manga_edition_id ON variant(manga_edition_id);
