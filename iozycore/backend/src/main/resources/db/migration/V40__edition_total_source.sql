-- V40__edition_total_source.sql
-- D'ou vient le nombre de tomes d'une edition francaise (lot 207).
-- total_source : MANUAL (tape par quelqu'un) ou PROVIDER (rempli par la tache
-- de fond a partir des listes de tomes de la BnF et de Google Books). Un total
-- MANUAL n'est jamais touche par la tache. Vide tant que le total est inconnu.
-- french_run_finished : la parution francaise est terminee, seulement quand une
-- source le dit (la serie d'origine est finie et le catalogue francais atteint
-- son nombre de tomes). Jamais devine.
-- total_checked_at : la derniere fois que la tache a interroge les sources pour
-- cette edition, qu'elle ait trouve ou non : elle n'y revient qu'apres un delai.
ALTER TABLE manga_edition ADD COLUMN total_source VARCHAR(16);
ALTER TABLE manga_edition ADD COLUMN french_run_finished BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE manga_edition ADD COLUMN total_checked_at TIMESTAMPTZ;

-- Jusqu'ici, seul un humain ecrivait ce total (saisie, import, analyse d'achat).
UPDATE manga_edition SET total_source = 'MANUAL' WHERE total_volumes IS NOT NULL;

ALTER TABLE manga_edition ADD CONSTRAINT manga_edition_total_source_check
    CHECK (total_source IS NULL OR total_source IN ('MANUAL', 'PROVIDER'));
