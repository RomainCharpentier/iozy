package com.iozycore.application.auth;

import java.util.UUID;

/**
 * Un visiteur sans compte, entré par la porte laissée ouverte.
 *
 * <h2>Un principal à part, et pas un {@code Principal} incomplet</h2>
 * La tentation était de réutiliser {@link AppUserDetailsService.Principal} avec
 * des champs vides. Elle est mauvaise : ce type est celui d'un COMPTE, et tout
 * ce qui le reçoit peut en lire l'adresse e-mail, le hachage du mot de passe et
 * le drapeau d'administration. Un visiteur n'a rien de tout cela, et un jour
 * quelqu'un aurait écrit {@code principal.email()} sur un chemin qu'un invité
 * atteint. Deux types distincts font que la question « est-ce un compte ? » se
 * pose à la compilation plutôt qu'à l'exécution.
 *
 * <h2>Ce qu'il porte, et pourquoi</h2>
 * {@code proprietaire} est la collection qu'il visite : c'est de là que vient
 * son cloisonnement, exactement comme le jeton d'un lien de partage nomme son
 * propriétaire (voir {@code AuNomDe}). Il n'est PAS choisi par le visiteur -
 * il est décidé par l'instance au moment d'ouvrir la session (voir
 * {@link Visite}), sans quoi n'importe qui désignerait la collection de
 * n'importe qui.
 *
 * <p>{@code hote} est le pseudo de la personne dont on visite la collection.
 * Il n'a aucun rôle technique : il est là pour que l'application puisse dire
 * « tu visites la collection de X » plutôt que de laisser croire à un visiteur
 * qu'il regarde la sienne. Le pseudo est public par destination (voir
 * {@code AuthController}) ; l'adresse e-mail de l'hôte, elle, ne sort pas.
 */
public record Invite(UUID proprietaire, String hote) {
}
