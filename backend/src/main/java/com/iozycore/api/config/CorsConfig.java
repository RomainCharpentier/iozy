package com.iozycore.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Autorise le client web (React) à appeler l'API. Contrairement à ce qu'on
 * pourrait attendre, ceci EST structurant même quand nginx/Vite proxient
 * déjà /api en apparence "same-origin" pour le navigateur : les requêtes
 * avec une méthode qui modifie l'état (POST/PATCH/DELETE) embarquent
 * toujours un header Origin, même same-origin (contrairement aux GET) -
 * Spring le vérifie sur toute requête qui le porte, qu'il s'agisse d'un
 * vrai cross-origin ou d'un proxy transparent en amont. Sans cette config,
 * ces requêtes échouent en 403 "Invalid CORS request" (constaté en testant
 * la création d'un type depuis le build Docker sur :8081).
 * <p>
 * Liste configurable via web.allowed-origins (WEB_ALLOWED_ORIGINS, CSV) -
 * par défaut les deux origines locales connues : le serveur de dev Vite
 * (:5173) et le build Docker local (:8081, service "web" de
 * docker-compose.yml). Pour un déploiement Synology, définir cette
 * variable avec le vrai domaine du service web (voir
 * docker-compose.synology.yml, sous-domaine app.iozycore.mondomaine.tld).
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    // Valeur par défaut définie dans application.yml (web.allowed-origins),
    // configurable via WEB_ALLOWED_ORIGINS.
    @Value("${web.allowed-origins}")
    private String allowedOriginsCsv;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOriginsCsv.split(","))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowedHeaders("*");
    }
}
