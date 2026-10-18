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
 * Outside a request, the integration tests speak in the name of the <b>first account</b>.
 *
 * <h2>Why the tests need this</h2>
 * In production, not knowing who writes is equal to {@link DefaultOwner#PERSONNE}:
 * a path that forgets to say it sees nothing. This is the right rule, and it
 * is still tested as it is ({@code UtilisateurCourantTest}).
 *
 * <p>But an integration test calls services <b>directly</b>, without an
 * HTTP request, so without a session - and Spring Security <b>clears</b> the
 * context at the end of each MockMvc call, even in the middle of a test.
 * A hundred tests write through a service and then read through a repository:
 * without this fallback, they would write in the name of nobody and would find an empty
 * database, for a reason that has nothing to do with what they check.
 *
 * <p>The fallback is {@link DefaultOwner#ID} - the identifier carried by everything
 * that the migrations and the existing tests created, and that the first account
 * of a real instance adopts. A test that wants to speak in the name of someone
 * else sets a real session: it always wins over this fallback (see
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
                // A VISITOR is nobody, and must stay so HERE TOO.
                //
                // This fallback exists for the tests that call services
                // outside a request, without a session: it makes them speak in the name of the
                // first account. But a visitor session IS a session -
                // it just does not name any owner - and the fallback would
                // have made it the first account. A visitor test would then have
                // passed while seeing someone's collection, that is to say while
                // stating the opposite of what it checks. Seen live:
                // `un_visiteur_voit_le_catalogue_et_aucune_possession` failed
                // on this line, and it was the stub that was wrong.
                //
                // The question is asked here and not in production, where the
                // fallback is already "nobody": so this is where it is
                // settled, without reopening in the production code a notion of
                // visitor that it does not need.
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
