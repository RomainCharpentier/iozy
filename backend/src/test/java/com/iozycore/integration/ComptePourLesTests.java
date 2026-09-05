package com.iozycore.integration;

import com.iozycore.core.application.auth.Invite;
import com.iozycore.core.application.auth.UtilisateurCourant;
import com.iozycore.core.domain.shared.DefaultOwner;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/**
 * Hors requête, les tests d'intégration parlent au nom du <b>premier compte</b>.
 *
 * <h2>Pourquoi les tests ont besoin de ça</h2>
 * En production, ne pas savoir qui écrit vaut {@link DefaultOwner#PERSONNE} :
 * un chemin qui oublie de le dire ne voit rien. C'est la bonne règle, et elle
 * reste testée telle quelle ({@code UtilisateurCourantTest}).
 *
 * <p>Mais un test d'intégration appelle des services <b>directement</b>, sans
 * requête HTTP, donc sans session - et Spring Security <b>efface</b> le
 * contexte à la fin de chaque appel MockMvc, y compris au milieu d'un test.
 * Une centaine de tests écrivent par un service puis relisent par un dépôt :
 * sans ce repli, ils écriraient au nom de personne et relèveraient une base
 * vide, pour une raison qui n'a rien à voir avec ce qu'ils vérifient.
 *
 * <p>Le repli vaut {@link DefaultOwner#ID} - l'identifiant que porte tout ce
 * que les migrations et les tests existants ont créé, et que le premier compte
 * d'une vraie instance adopte. Un test qui veut parler au nom de quelqu'un
 * d'autre pose une vraie session : elle l'emporte toujours sur ce repli (voir
 * {@code IsolationParProprietaireTest}).
 *
 */
@TestConfiguration
public class ComptePourLesTests {

    @Bean
    @Primary
    UtilisateurCourant utilisateurCourantDeTest() {
        return new UtilisateurCourant() {
            @Override
            public UUID proprietaire() {
                // Une VISITE n'est personne, et doit le rester ICI AUSSI.
                //
                // Ce repli existe pour les tests qui appellent des services
                // hors requête, sans session : il les fait parler au nom du
                // premier compte. Mais une session de visite EST une session -
                // elle ne nomme simplement aucun propriétaire - et le repli en
                // aurait fait le premier compte. Un test de visite serait alors
                // passé en voyant la collection de quelqu'un, c'est-à-dire en
                // affirmant l'inverse de ce qu'il vérifie. Constaté en direct :
                // `un_visiteur_voit_le_catalogue_et_aucune_possession` a échoué
                // sur cette ligne, et c'est bien le stub qui avait tort.
                //
                // La question se pose ici et pas dans la production, où le
                // repli vaut déjà « personne » : c'est donc ici qu'elle se
                // règle, sans rouvrir dans le code de production une notion de
                // visiteur dont il n'a pas besoin.
                if (estUneVisite()) {
                    return DefaultOwner.PERSONNE;
                }
                return id().orElse(DefaultOwner.ID);
            }
        };
    }

    private static boolean estUneVisite() {
        Authentication authentification = SecurityContextHolder.getContext().getAuthentication();
        return authentification != null && authentification.getPrincipal() instanceof Invite;
    }
}
