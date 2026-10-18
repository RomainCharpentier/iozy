-- V19__drop_loan.sql
-- Retrait de la fonctionnalité de prêts (voir V5__loan.sql, qui l'avait créée).
--
-- Pourquoi : les prêts ont été retirés de l'interface, aucun client (web,
-- iOS, script) n'appelle plus /api/loans, et la table est vide. Un contrôleur
-- sans écran, une table sans fonctionnalité et un repository sans appelant
-- coûtent plus à lire qu'ils ne rendent. V5 n'est pas réécrite : l'histoire
-- des migrations reste fidèle à ce qui a réellement existé.
--
-- Conséquence assumée : la suppression d'une Ownership n'est plus bloquée par
-- un prêt (voir OwnershipDeletionService). Cette garde protégeait un
-- historique de prêt contre une possession disparue - sans prêts, elle
-- protégeait un concept qui n'existe plus.

-- Garde-fou : cette migration DÉTRUIT des données si la table n'est pas vide.
-- Vérifiée à 0 ligne avant écriture, mais si elle est un jour rejouée sur une
-- base qui en contient, elle doit échouer bruyamment plutôt que d'effacer en
-- silence un historique que personne n'a exporté.
DO $$
DECLARE
    prets_existants BIGINT;
BEGIN
    SELECT count(*) INTO prets_existants FROM loan;
    IF prets_existants > 0 THEN
        RAISE EXCEPTION
            'V19 refuse de supprimer la table loan : % prêt(s) enregistré(s). '
            'Exportez ou supprimez explicitement ces données avant de rejouer cette migration.',
            prets_existants;
    END IF;
END $$;

DROP TABLE loan;
