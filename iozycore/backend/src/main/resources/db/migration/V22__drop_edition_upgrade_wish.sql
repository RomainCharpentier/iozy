-- V22__drop_edition_upgrade_wish.sql
-- Retrait des « envies d'amélioration d'édition » (voir V6__edition_upgrade_wish.sql,
-- qui les avait créées).
--
-- Pourquoi : la fonctionnalité a quitté l'interface au Lot 27 (« Envies
-- d'amélioration » retirée), et rien ne l'a remplacée depuis. Le contrôleur
-- REST n'a plus AUCUN appelant - ni web, ni iOS, vérifié en croisant les 99
-- routes du backend avec les deux clients - et la table est vide. Il restait
-- un contrôleur sans écran, un domaine sans écrivain, un repository lu par le
-- seul export, et un fichier CSV toujours vide dans l'archive.
--
-- Même geste et mêmes raisons qu'au V19 pour les prêts. V6 n'est pas
-- réécrite : l'histoire des migrations reste fidèle à ce qui a existé.
--
-- À ne pas confondre avec `followed_edition` (V20), bien vivante : « je suis
-- CETTE édition » n'est pas « je voudrais changer d'édition » (voir la javadoc
-- de FollowedEdition, qui distinguait déjà les deux).

-- Garde-fou : cette migration DÉTRUIT des données si la table n'est pas vide.
-- Vérifiée à 0 ligne avant écriture, mais si elle est un jour rejouée sur une
-- base qui en contient, elle doit échouer bruyamment plutôt que d'effacer en
-- silence des souhaits que personne n'a exportés.
DO $$
DECLARE
    souhaits_existants BIGINT;
BEGIN
    SELECT count(*) INTO souhaits_existants FROM edition_upgrade_wish;
    IF souhaits_existants > 0 THEN
        RAISE EXCEPTION
            'V22 refuse de supprimer la table edition_upgrade_wish : % souhait(s) enregistré(s). '
            'Exportez ou supprimez explicitement ces données avant de rejouer cette migration.',
            souhaits_existants;
    END IF;
END $$;

DROP TABLE edition_upgrade_wish;
