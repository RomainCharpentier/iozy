package com.iozycore.api.config;

import com.iozycore.application.auth.AppUserDetailsService;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * La porte de l'application.
 *
 * <h2>Ce qui reste ouvert, et pourquoi</h2>
 * Trois chemins seulement : la <b>création du premier compte</b> et la
 * <b>connexion</b> (sans quoi personne ne pourrait jamais entrer), et
 * <b>{@code /api/public/**}</b> - les liens de partage, dont c'est toute la
 * raison d'être : un visiteur à qui l'on envoie un lien n'a pas de compte.
 * Leur filtrage est fait côté serveur et couvert par un test qui cherche les
 * données privées dans la réponse sérialisée.
 *
 * <p>Tout le reste demande une session, <b>y compris Swagger</b>. Une
 * documentation d'API qui déclare 92 routes est aussi une carte : elle
 * n'apporte rien à qui n'a pas le droit de les appeler. On se connecte
 * d'abord, la session vaut pour Swagger comme pour l'app.
 *
 * <h2>Une session, pas un jeton dans le navigateur</h2>
 * Un cookie {@code HttpOnly} n'est pas lisible par du JavaScript ; un jeton
 * rangé dans {@code localStorage} l'est par n'importe quel script injecté.
 * Et l'architecture de ce dépôt sert déjà l'API sous la MÊME origine que
 * l'app (proxy Vite en développement, nginx en production, voir
 * web/README.md) : le cookie voyage donc sans configuration cross-site.
 *
 * <p>Conséquence assumée : les sessions vivent en mémoire, un redémarrage du
 * serveur déconnecte tout le monde. Sur une application de collection
 * personnelle, se reconnecter après une mise à jour est un prix acceptable -
 * bien plus que la dépendance qu'un magasin de sessions partagé ajouterait.
 *
 * <h2>CSRF : activé, parce que le cookie voyage tout seul</h2>
 * C'est la contrepartie exacte du choix précédent. Un cookie de session part
 * automatiquement avec la requête, y compris quand c'est une AUTRE page qui la
 * déclenche - c'est la définition d'une CSRF. Le jeton est déposé dans un
 * cookie lisible par le client (voir {@link CookieCsrfTokenRepository}), que
 * {@code web/src/api/client.ts} renvoie en en-tête sur toute écriture. Une page
 * tierce ne peut pas lire ce cookie, donc pas forger l'en-tête.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Le jeton CSRF est <b>différé</b> depuis Spring Security 6 : le cookie
     * n'est écrit que si quelqu'un lit le jeton pendant la requête. Sans ce
     * filtre, un client qui n'a fait que des GET n'aurait jamais reçu de
     * cookie, et sa première écriture serait refusée - y compris la connexion
     * elle-même, tout premier appel d'une session.
     */
    static class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                throws ServletException, IOException {
            CsrfToken jeton = (CsrfToken) request.getAttribute("_csrf");
            if (jeton != null) {
                jeton.getToken();
            }
            chain.doFilter(request, response);
        }
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // BCrypt, force par défaut (10) : lent à dessein, et le seul coût est
        // celui d'une connexion - une poignée par jour sur cette application.
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        // Explicite parce que le contrôleur de connexion l'utilise directement :
        // depuis Spring Security 6, authentifier ne suffit plus à retenir, il
        // faut écrire le contexte dans la session soi-même.
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public AuthenticationManager authenticationManager(AppUserDetailsService comptes, PasswordEncoder encodeur) {
        DaoAuthenticationProvider fournisseur = new DaoAuthenticationProvider();
        fournisseur.setUserDetailsService(comptes);
        fournisseur.setPasswordEncoder(encodeur);
        // Sans ça, une adresse inconnue échoue plus vite qu'un mot de passe
        // faux : le temps de réponse dirait à un attaquant quelles adresses
        // existent. Le fournisseur compare alors contre un hachage factice.
        fournisseur.setHideUserNotFoundExceptions(true);
        return new org.springframework.security.authentication.ProviderManager(fournisseur);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, SecurityContextRepository contextes) throws Exception {
        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        // Le gestionnaire PAR DÉFAUT masque le jeton (protection
                        // BREACH) : il attend en retour la valeur masquée qu'il a
                        // exposée dans la page, pas celle du cookie. Un client qui
                        // lit le cookie renvoie donc une valeur que le démasquage
                        // rejette - 403 sur toute écriture, y compris la première
                        // connexion (constaté en direct). Le masquage n'a de toute
                        // façon rien à protéger ici : le jeton est déjà dans un
                        // cookie lisible, c'est le principe même du montage.
                        .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
                .addFilterAfter(new CsrfCookieFilter(), UsernamePasswordAuthenticationFilter.class)
                // La configuration CORS existante (voir CorsConfig) ne s'applique
                // que si la chaîne de sécurité la consulte.
                .cors(org.springframework.security.config.Customizer.withDefaults())
                .securityContext(contexte -> contexte.securityContextRepository(contextes))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(routes -> routes
                        // La page d'erreur n'est pas une route : c'est le
                        // RENDU d'une requête déjà tranchée par les règles
                        // ci-dessous. Depuis Spring Security 6, la chaîne
                        // s'applique aussi à cette redirection interne : sans
                        // cette ligne, un 404 destiné à un visiteur anonyme
                        // repartait en 401 - constaté en direct sur un lien de
                        // partage, alors que les tests MockMvc, qui ne
                        // rejouent pas cette redirection, disaient 404.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/etat").permitAll()
                        // Les liens de partage : leur destinataire n'a pas de compte.
                        .requestMatchers("/api/public/**").permitAll()
                        // L'administration de l'INSTANCE - qui a un compte, et
                        // en supprimer un. Déclarée AVANT `anyRequest`, sans
                        // quoi « authentifié » suffirait : la première règle
                        // qui correspond gagne. Rien ici n'ouvre les données
                        // d'autrui, qui restent filtrées par propriétaire.
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                // Une API répond 401, elle ne redirige pas vers une page de
                // connexion : c'est le client qui décide quoi montrer.
                .exceptionHandling(erreurs -> erreurs.authenticationEntryPoint(
                        new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .httpBasic(basic -> basic.disable())
                .formLogin(form -> form.disable())
                .logout(logout -> logout.disable());
        return http.build();
    }
}
