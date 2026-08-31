package com.iozycore.application.auth;

import com.iozycore.domain.shared.DefaultOwner;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Qui écrit, en ce moment même.
 *
 * <h2>Le seul endroit qui interroge la session</h2>
 * Le reste de l'application demande simplement « à qui », sans savoir d'où la
 * réponse vient. Le jour où la session change de forme (jeton, en-tête,
 * autre), c'est ce fichier qui change, et lui seul.
 *
 * <h2>Sans compte connu : personne, jamais « le premier »</h2>
 * {@link #proprietaire()} rend {@link DefaultOwner#PERSONNE} hors d'une
 * requête authentifiée. Aucune ligne ne lui appartient : un chemin qui
 * oublierait de dire au nom de qui il travaille ne voit <b>rien</b>. Un repli
 * sur {@link DefaultOwner#ID} - l'identifiant du premier compte, celui qui a
 * repris la collection d'origine - aurait fait exactement l'inverse, et sans
 * bruit.
 */
@Component
public class UtilisateurCourant {

    /**
     * L'identifiant du COMPTE connecté, vide hors d'une requête authentifiée -
     * et vide aussi pour un invité, qui n'en a pas.
     */
    public Optional<UUID> id() {
        return principal()
                .filter(AppUserDetailsService.Principal.class::isInstance)
                .map(AppUserDetailsService.Principal.class::cast)
                .map(AppUserDetailsService.Principal::id);
    }

    /**
     * Le propriétaire auquel rattacher une écriture, ou dont lire les données.
     * Pour un invité, la collection qu'il visite - décidée par l'instance à
     * l'ouverture de la session, jamais par la requête (voir {@code Visite}).
     */
    public UUID proprietaire() {
        Object qui = principal().orElse(null);
        if (qui instanceof Invite invite) {
            return invite.proprietaire();
        }
        if (qui instanceof AppUserDetailsService.Principal compte) {
            return compte.id();
        }
        return DefaultOwner.PERSONNE;
    }

    /** Le visiteur en cours, s'il s'agit d'une visite plutôt que d'un compte. */
    public Optional<Invite> invite() {
        return principal().filter(Invite.class::isInstance).map(Invite.class::cast);
    }

    private Optional<Object> principal() {
        Authentication authentification = SecurityContextHolder.getContext().getAuthentication();
        if (authentification == null || !authentification.isAuthenticated()) {
            return Optional.empty();
        }
        return Optional.ofNullable(authentification.getPrincipal());
    }
}
