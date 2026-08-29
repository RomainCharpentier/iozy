-- V27__pseudo.sql
-- Le nom d'un compte devient un PSEUDO : unique, obligatoire, et le seul nom
-- sous lequel une personne apparaît dans l'application.
--
-- Ce que `display_name` était : facultatif, non unique, et rempli avec
-- l'ADRESSE E-MAIL quand on ne saisissait rien (voir AppUser, repli
-- historique). Deux conséquences, toutes deux visibles à l'écran : deux
-- comptes pouvaient porter le même nom sans qu'on puisse les distinguer, et
-- l'avatar du menu affichait l'adresse de quelqu'un plutôt que son nom.
--
-- La colonne est RENOMMÉE plutôt que doublée : c'est le même champ, avec des
-- règles enfin posées. Une seconde colonne aurait laissé l'ancienne vivre,
-- lue quelque part, et personne n'aurait su laquelle fait foi.

ALTER TABLE app_user RENAME COLUMN display_name TO pseudo;

-- 1. Réparer ce qui ne peut pas être un pseudo.
--
--    Repérage volontairement ÉTROIT - une arobase, une espace, ou une
--    longueur hors bornes. Un nom déjà plausible (« Romain », « kenshin ») est
--    laissé tel quel : le réécrire changerait le nom de quelqu'un sans raison.
--    Les accents, eux, sont autorisés par le domaine et ne déclenchent rien.
--
--    Le remplacement vient de la partie locale de l'adresse, nettoyée de ce
--    que le format n'accepte pas. Trop courte pour faire un pseudo (trois
--    caractères minimum), on retombe sur « membre » - jamais sur un vide, que
--    la contrainte refuserait.
UPDATE app_user
SET pseudo = CASE
        WHEN char_length(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g')) >= 3
            THEN left(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'), 24)
        ELSE 'membre'
    END
WHERE pseudo ~ '[@[:space:]]'
   OR char_length(pseudo) < 3
   OR char_length(pseudo) > 24;

-- 2. Départager ceux qui se retrouvent identiques.
--
--    Vaut pour les pseudos réparés ci-dessus comme pour ceux qui étaient déjà
--    en double : le plus ancien garde son nom, les suivants reçoivent un
--    numéro. Sans ce passage, l'index unique de l'étape 3 ferait échouer la
--    migration sur une instance à plusieurs comptes - et une migration qui
--    échoue chez quelqu'un d'autre est un défaut, pas une protection.
WITH doublons AS (
    SELECT id, row_number() OVER (PARTITION BY lower(pseudo) ORDER BY created_at, id) AS rang
    FROM app_user
)
UPDATE app_user u
SET pseudo = left(u.pseudo, 20) || d.rang
FROM doublons d
WHERE u.id = d.id AND d.rang > 1;

-- 3. L'unicité, sans tenir compte de la casse.
--
--    Même règle que l'adresse e-mail : deux comptes ne peuvent pas différer
--    par la seule casse. `lower()` et non un `citext` ou une collation : un
--    index fonctionnel suffit, ne demande aucune extension, et dit sa règle
--    là où on la lit.
CREATE UNIQUE INDEX app_user_pseudo_unique ON app_user (lower(pseudo));
