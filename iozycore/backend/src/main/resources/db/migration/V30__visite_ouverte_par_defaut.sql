-- V30__visite_ouverte_par_defaut.sql
-- La visite sans compte devient OUVERTE par défaut.
--
-- La V29 posait l'inverse, avec un argument que je maintiens en général : une
-- migration n'ouvre pas un accès que personne n'a demandé. Ici, quelqu'un l'a
-- demandé - explicitement, après avoir vu la case. Le reproche fait à la
-- version précédente était juste : « accès visiteur depuis l'écran de login
-- SANS autorisation nécessaire ». Une case à cocher au préalable, c'est
-- exactement l'autorisation qu'on ne voulait pas.
--
-- La case ne disparaît pas pour autant : elle change de sens. Elle servait à
-- ouvrir, elle sert maintenant à REFERMER. Garder l'interrupteur ne coûte rien
-- et laisse le dernier mot au propriétaire ; le supprimer aurait rendu
-- l'ouverture définitive, ce qui n'a été demandé nulle part.
--
-- Conséquence à connaître : sur une instance publiée, la collection du premier
-- compte devient lisible par quiconque en connaît l'adresse. C'est le sens de
-- la demande, pas un effet de bord.
ALTER TABLE share_settings ALTER COLUMN open_to_guests SET DEFAULT true;

-- Les lignes existantes suivent. Sans cette ligne, un espace dont le partage a
-- déjà été réglé une fois resterait fermé pendant que tous les autres seraient
-- ouverts - deux comportements pour le même réglage, selon qu'on y a touché ou
-- non avant aujourd'hui.
UPDATE share_settings SET open_to_guests = true;
