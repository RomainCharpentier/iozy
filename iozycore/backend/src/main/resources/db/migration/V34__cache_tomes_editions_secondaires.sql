-- Lot 144 : la chaine des tomes change (romans jeunesse ecartes a la BnF,
-- editions secondaires completees chez Google Books). Regle posee au lot
-- 131 : a chaque changement de chaine, une migration vide le cache durable
-- des tomes - il ne se perime jamais et resservirait l'ancienne chaine.
-- Rien n'est perdu, il se reconstruit a la demande.
DELETE FROM volume_search_cache;
