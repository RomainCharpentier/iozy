-- V8__ownership_purchase_price.sql
-- Prix d'achat, optionnel (voir com.iozycore.core.domain.ownership.Ownership) -
-- hors périmètre du MVP initial ("simplification demandée", voir
-- docs/CONCEPTION.md §4), ajouté depuis sur demande explicite pour
-- "calcul automatique de la valeur de la collection" (§15 V2). NULL par
-- défaut sur toutes les lignes existantes - jamais deviné rétroactivement.
ALTER TABLE ownership ADD COLUMN purchase_price NUMERIC(10, 2);
