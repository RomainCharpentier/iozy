package com.iozycore.domain.user;

import com.iozycore.domain.shared.DefaultOwner;

import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Un compte, et rien d'autre.
 *
 * <h2>Ce qu'il ne porte pas</h2>
 * Ni rôle, ni permission, ni statut. Tous les comptes de cette application
 * peuvent exactement la même chose - chacun sur SA collection. Un système de
 * rôles n'aurait rien à distinguer, et une colonne « admin » posée « au cas
 * où » finirait par être lue quelque part sans qu'aucune règle ne dise
 * jamais ce qu'elle change.
 *
 * <h2>L'identifiant EST le propriétaire</h2>
 * Les colonnes {@code owner_id} existent depuis la migration V2, remplies
 * avec {@link DefaultOwner#ID}. Un compte n'a donc pas besoin d'un second
 * identifiant : son {@code id} est celui qu'on retrouvera dans ces colonnes.
 * C'est ce qui permet au tout premier compte de <b>reprendre</b> les données
 * déjà en base en adoptant cet identifiant, sans qu'une seule ligne ne bouge.
 *
 * @param email        rangé en minuscules et sans espaces de bord - deux comptes
 *                     ne peuvent pas différer par la seule casse
 * @param passwordHash le hachage, jamais le mot de passe. Ce record traverse
 *                     l'application ; le mot de passe en clair, lui, ne vit que
 *                     le temps d'un appel à l'encodeur
 * @param pseudo       le seul nom sous lequel une personne apparaît. Unique
 *                     (voir la migration V27), obligatoire, et jamais
 *                     l'adresse e-mail : celle-ci sert à se connecter, pas à
 *                     se montrer. <b>Fixé à l'inscription</b> et jamais
 *                     modifié - décision produit, pas une fonctionnalité
 *                     remise à plus tard : un pseudo qu'on peut reprendre
 *                     désigne quelqu'un d'autre demain, et aucune surface qui
 *                     l'a affiché ne le saura. Aucune route ne l'écrit après
 *                     {@code POST /api/auth/register}
 */
public record AppUser(UUID id, String email, String passwordHash, String pseudo, Instant createdAt) {

    /**
     * Ce qu'un pseudo a le droit d'être.
     *
     * <h2>Trois à vingt-quatre caractères</h2>
     * En dessous de trois, il ne distingue plus rien ; au-delà de vingt-quatre,
     * il ne tient plus dans les endroits qui l'affichent, à commencer par
     * l'avatar du menu.
     *
     * <h2>Lettres, chiffres, et trois séparateurs</h2>
     * Les <b>accents sont acceptés</b> ({@code \p{L}} et non {@code [a-z]}) :
     * refuser « Rémi » dans une application française serait une règle
     * technique déguisée en règle produit. Sont refusés l'espace - qui rend
     * deux pseudos indistinguables à l'œil, « jean dupont » et
     * « jean  dupont » - et l'arobase, qui ferait passer un pseudo pour une
     * adresse.
     *
     * <h2>Il commence par une lettre ou un chiffre</h2>
     * Sinon {@code ...} et {@code ---} seraient des pseudos valides, et deux
     * personnes seraient distinguées par un motif que personne ne peut lire à
     * voix haute.
     */
    private static final Pattern FORME_DE_PSEUDO =
            Pattern.compile("^[\\p{L}\\p{N}][\\p{L}\\p{N}._-]{2,23}$", Pattern.UNICODE_CHARACTER_CLASS);

    public AppUser {
        if (id == null) {
            throw new IllegalArgumentException("Un compte doit porter un identifiant");
        }
        email = normaliserEmail(email);
        if (email.isEmpty()) {
            throw new IllegalArgumentException("Un compte doit porter une adresse e-mail");
        }
        if (passwordHash == null || passwordHash.isBlank()) {
            throw new IllegalArgumentException("Un compte doit porter un mot de passe haché");
        }
        pseudo = pseudo == null ? "" : pseudo.trim();
        if (!estUnPseudoValide(pseudo)) {
            throw new IllegalArgumentException("Un compte doit porter un pseudo valide");
        }
        createdAt = createdAt == null ? Instant.now() : createdAt;
    }

    /**
     * Vrai quand ce texte peut servir de pseudo.
     * <p>
     * Publique parce que la porte doit pouvoir <b>expliquer</b> un refus à
     * l'utilisateur (400 avec une phrase) plutôt que de laisser remonter une
     * exception de construction, qui n'est jamais destinée à être lue.
     */
    public static boolean estUnPseudoValide(String pseudo) {
        return pseudo != null && FORME_DE_PSEUDO.matcher(pseudo.trim()).matches();
    }

    /**
     * La forme sous laquelle deux pseudos se comparent : la casse ne distingue
     * pas deux personnes, exactement comme pour l'adresse (voir la migration
     * V27, qui pose l'index unique sur {@code lower(pseudo)}).
     */
    public static String normaliserPseudo(String pseudo) {
        return pseudo == null ? "" : pseudo.trim().toLowerCase();
    }

    /**
     * La forme sous laquelle une adresse se compare et se range.
     * <p>
     * Publique parce que la comparaison se fait aussi à la lecture (chercher
     * un compte par son adresse saisie au clavier) : deux normalisations
     * écrites séparément finiraient par diverger, et un utilisateur se
     * verrait refuser sa propre adresse pour une majuscule.
     */
    public static String normaliserEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    /**
     * Le tout premier compte adopte l'identifiant du propriétaire par défaut :
     * la collection déjà saisie devient la sienne. Les suivants reçoivent un
     * identifiant neuf, donc une collection vide.
     */
    public static AppUser premier(String email, String passwordHash, String pseudo) {
        return new AppUser(DefaultOwner.ID, email, passwordHash, pseudo, Instant.now());
    }

    public static AppUser nouveau(String email, String passwordHash, String pseudo) {
        return new AppUser(UUID.randomUUID(), email, passwordHash, pseudo, Instant.now());
    }
}
