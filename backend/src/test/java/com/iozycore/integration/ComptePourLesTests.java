package com.iozycore.integration;

import com.iozycore.application.auth.Invite;
import com.iozycore.application.auth.UtilisateurCourant;
import com.iozycore.domain.shared.DefaultOwner;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

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
 * <h2>Une VISITE l'emporte aussi, et il a fallu l'écrire</h2>
 * Un invité n'a pas de compte : {@code id()} est vide pour lui, et la
 * collection qu'il parcourt est portée par son principal. Le repli seul
 * l'aurait donc renvoyé sur le premier compte - c'est-à-dire, la plupart du
 * temps, sur la bonne réponse par accident, et sur un test de visite qui
 * passerait sans rien vérifier.
 */
@TestConfiguration
public class ComptePourLesTests {

    @Bean
    @Primary
    UtilisateurCourant utilisateurCourantDeTest() {
        return new UtilisateurCourant() {
            @Override
            public UUID proprietaire() {
                return invite().map(Invite::proprietaire).orElseGet(() -> id().orElse(DefaultOwner.ID));
            }
        };
    }
}
