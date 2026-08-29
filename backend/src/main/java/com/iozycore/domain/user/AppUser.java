package com.iozycore.domain.user;

import com.iozycore.domain.shared.DefaultOwner;

import java.time.Instant;
import java.util.UUID;

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
 */
public record AppUser(UUID id, String email, String passwordHash, String displayName, Instant createdAt) {

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
        displayName = displayName == null || displayName.isBlank() ? email : displayName.trim();
        createdAt = createdAt == null ? Instant.now() : createdAt;
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
    public static AppUser premier(String email, String passwordHash, String displayName) {
        return new AppUser(DefaultOwner.ID, email, passwordHash, displayName, Instant.now());
    }

    public static AppUser nouveau(String email, String passwordHash, String displayName) {
        return new AppUser(UUID.randomUUID(), email, passwordHash, displayName, Instant.now());
    }
}
