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
 * Toute la suite du chantier multi-utilisateur passera par ici : remplacer
 * {@link DefaultOwner#ID} à la création d'une possession, d'une envie, d'un
 * classement. Un seul endroit qui sait lire la session, et le reste de
 * l'application qui demande simplement « à qui ». Le jour où la session
 * change de forme (jeton, en-tête, autre), c'est ce fichier qui change.
 *
 * <h2>Pourquoi un repli existe encore</h2>
 * {@link #proprietaire()} rend {@link DefaultOwner#ID} hors de toute requête
 * authentifiée - un import lancé en tâche de fond, un test qui appelle un
 * service directement. Ce repli disparaîtra avec l'isolation par propriétaire,
 * quand chaque écriture saura nommer son auteur ; le laisser aujourd'hui évite
 * de faire échouer du code qui n'a pas encore été rattaché.
 */
@Component
public class UtilisateurCourant {

    /** L'identifiant du compte connecté, vide hors d'une requête authentifiée. */
    public Optional<UUID> id() {
        Authentication authentification = SecurityContextHolder.getContext().getAuthentication();
        if (authentification == null || !authentification.isAuthenticated()) {
            return Optional.empty();
        }
        if (authentification.getPrincipal() instanceof AppUserDetailsService.Principal principal) {
            return Optional.of(principal.id());
        }
        return Optional.empty();
    }

    /** Le propriétaire auquel rattacher une écriture. */
    public UUID proprietaire() {
        return id().orElse(DefaultOwner.ID);
    }
}
