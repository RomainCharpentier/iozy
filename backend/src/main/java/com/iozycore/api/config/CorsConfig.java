package com.iozycore.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Autorise le client web (React/Vite) à appeler l'API depuis un port
 * différent - utile uniquement pour `npm run dev` (localhost:5173). En dev
 * comme en prod, le proxy Vite (web/vite.config.ts) ou nginx (web/nginx.conf,
 * services "web" de docker-compose.yml et docker-compose.synology.yml)
 * redirige déjà /api vers ce serveur sans passer par le navigateur - donc
 * cette config CORS n'est pas structurante au quotidien, seulement un filet
 * de sécurité pour les cas où le front n'est pas servi via un de ces deux
 * proxys (ex: `vite preview`, ou un appel direct à l'API depuis un autre
 * outil web pointant sur localhost:5173).
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
