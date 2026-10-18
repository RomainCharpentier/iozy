-- V28__compte_admin.sql
-- Un drapeau d'administration sur les comptes.
--
-- Jusqu'ici, AppUser disait explicitement « ni rôle, ni permission, ni statut :
-- tous les comptes peuvent exactement la même chose ». C'était vrai tant que
-- personne n'avait à répondre de l'instance elle-même - qui a un compte, et qui
-- n'en a plus. Ce drapeau ne change rien d'autre : un administrateur n'a AUCUN
-- accès à la collection de qui que ce soit (l'isolation par propriétaire est
-- intacte), il voit des métadonnées et peut supprimer un compte.
--
-- Un booléen et non une table de rôles : il n'y a qu'une distinction à faire,
-- et une table `role`/`user_role` pour deux valeurs possibles serait une
-- machinerie dont personne ne lirait jamais la deuxième ligne.

ALTER TABLE app_user ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;

-- Le compte le plus ancien devient administrateur.
--
-- Sans cette ligne, une instance déjà en service se retrouverait avec un écran
-- d'administration que PERSONNE ne peut ouvrir, et il faudrait du SQL pour
-- démarrer - exactement le genre de dette qu'une migration doit éviter. Le
-- plus ancien, parce que c'est celui qui a repris la collection d'origine
-- (voir AppUser.premier et DefaultOwner) : sur toute instance existante, c'est
-- la personne qui l'a déployée.
--
-- Sur une base neuve, cette requête ne touche rien : c'est alors le premier
-- compte CRÉÉ qui naît administrateur (voir AuthService).
UPDATE app_user
SET is_admin = true
WHERE id = (SELECT id FROM app_user ORDER BY created_at, id LIMIT 1);

-- Nommer un second administrateur se fait en SQL, délibérément : c'est un geste
-- rare, et lui donner un bouton demanderait de décider qui peut appuyer dessus.
--   UPDATE app_user SET is_admin = true WHERE lower(pseudo) = 'kenshin';
