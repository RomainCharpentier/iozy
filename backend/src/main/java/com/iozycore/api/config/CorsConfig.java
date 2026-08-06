package com.iozycore.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Autorise le client web (React/Vite) à appeler l'API depuis un port
 * différent. En dev, le proxy Vite (voir web/vite.config.ts) redirige déjà
 * /api vers ce serveur sans passer par le navigateur, donc cette config
 * n'est pas structurante au quotidien - c'est un filet de sécurité pour
 * les cas où le front n'est pas servi via ce proxy (ex: `vite preview`).
 *
 * TODO(déploiement web) : cette config n'autorise aujourd'hui que le
 * serveur de dev Vite (localhost:5173). Le jour où web/ est buildé et
 * servi séparément de l'API (ex: Synology), il faudra soit (a) ajouter
 * son origine de production ici, soit (b) servir web/ et l'API depuis le
 * même reverse proxy Traefik pour éviter CORS entièrement (recommandé -
 * voir backend/docker-compose.synology.yml, aucun service web n'y existe
 * encore).
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:5173")
                .allowedMethods("GET", "POST", "PATCH", "DELETE")
                .allowedHeaders("*");
    }
}
