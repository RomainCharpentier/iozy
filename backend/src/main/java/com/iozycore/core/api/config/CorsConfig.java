package com.iozycore.core.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Allows the web client (React) to call the API. Unlike what one
 * might expect, this IS structural even when nginx/Vite already proxy
 * /api so that it looks "same-origin" to the browser: requests
 * with a state-changing method (POST/PATCH/DELETE) always
 * carry an Origin header, even same-origin (unlike GET) -
 * Spring checks it on any request that carries it, whether it is a
 * real cross-origin or a transparent proxy upstream. Without this config,
 * these requests fail with 403 "Invalid CORS request" (seen when testing
 * the creation of a type from the Docker build on :8081).
 * <p>
 * List configurable via web.allowed-origins (WEB_ALLOWED_ORIGINS, CSV) -
 * by default the two known local origins: the Vite dev server
 * (:5173) and the local Docker build (:8081, "web" service of
 * docker-compose.yml). For a Synology deployment, set this
 * variable with the real domain of the web service (see
 * docker-compose.synology.yml, subdomain app.iozycore.mydomain.tld).
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    // Default value defined in application.yml (web.allowed-origins),
    // configurable via WEB_ALLOWED_ORIGINS.
    @Value("${web.allowed-origins}")
    private String allowedOriginsCsv;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOriginsCsv.split(","))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowedHeaders("*")
                // Since there is a session: without this, a browser
                // does NOT send the cookie on a cross-origin call, and
                // does not accept the one sent back to it - the sign-in
                // would seem to succeed then every call would be back to 401.
                // No effect in the usual setup (the app and the API are
                // served under the same origin), decisive if they
                // ever end up on two domains.
                .allowCredentials(true);
    }
}
