package com.iozycore.integration.http;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcBuilderCustomizer;
import org.springframework.context.annotation.Bean;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Makes each contract request go out in the name of a connected account, with its
 * CSRF token.
 *
 * <p>Set here, in one single place, rather than added by hand to hundreds
 * of calls: a {@code .with(csrf())} forgotten somewhere would read as a
 * defect of the controller being tested, when it would be a defect of the test.
 *
 * <p>A separate class and not nested in {@code HttpContractTestBase}:
 * Spring Boot only detects nested {@code @TestConfiguration} on the
 * test class really executed, never on an abstract parent class -
 * the {@code @Import} of the parent class, however, is inherited.
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
