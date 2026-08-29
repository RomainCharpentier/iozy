package com.iozycore.integration.http;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcBuilderCustomizer;
import org.springframework.context.annotation.Bean;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Fait partir chaque requête de contrat au nom d'un compte connecté, avec son
 * jeton CSRF.
 *
 * <p>Posé ici, en un seul endroit, plutôt qu'ajouté à la main sur des centaines
 * d'appels : un {@code .with(csrf())} oublié quelque part se lirait comme un
 * défaut du contrôleur qu'on teste, alors que ce serait un défaut du test.
 *
 * <p>Une classe à part et non imbriquée dans {@code HttpContractTestBase} :
 * Spring Boot ne détecte les {@code @TestConfiguration} imbriquées que sur la
 * classe de test réellement exécutée, jamais sur une classe mère abstraite -
 * l'{@code @Import} de la classe mère, lui, est bien hérité.
 */
@TestConfiguration
public class RequetesAuthentifiees {

    @Bean
    MockMvcBuilderCustomizer authentifierEtSignerChaqueRequete() {
        return builder -> builder.defaultRequest(get("/")
                .with(user(HttpContractTestBase.IDENTITE_DE_TEST))
                .with(csrf()));
    }
}
