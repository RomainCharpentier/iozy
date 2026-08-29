package com.iozycore.application.auth;

import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Le pont entre les comptes de l'application et Spring Security.
 *
 * <p>Le principal qui en sort porte l'{@link AppUser#id()} : c'est LUI que
 * l'application lira pour savoir à qui appartient ce qu'on écrit (voir
 * {@link UtilisateurCourant}). Un principal réduit à une adresse e-mail
 * obligerait chaque écriture à rouvrir la table des comptes.
 */
@Service
public class AppUserDetailsService implements UserDetailsService {

    /** Aucun rôle dans cette application : tous les comptes peuvent la même chose. */
    private static final List<org.springframework.security.core.GrantedAuthority> AUCUN_ROLE = List.of();

    private final AppUserRepository comptes;

    public AppUserDetailsService(AppUserRepository comptes) {
        this.comptes = comptes;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        AppUser compte = comptes.findByEmail(AppUser.normaliserEmail(email))
                .orElseThrow(() -> new UsernameNotFoundException("Compte inconnu"));
        return new Principal(compte.id(), compte.email(), compte.passwordHash(), compte.displayName());
    }

    /**
     * Ce que la session retient d'un compte : de quoi savoir qui écrit, et rien
     * de plus. Le hachage y figure parce que Spring Security compare le mot de
     * passe fourni à celui-ci ; il ne sort jamais vers un client (voir
     * {@code AuthController}, qui rend une vue explicite du compte).
     */
    public record Principal(UUID id, String email, String motDePasseHache, String displayName) implements UserDetails {

        @Override
        public List<org.springframework.security.core.GrantedAuthority> getAuthorities() {
            return AUCUN_ROLE;
        }

        @Override
        public String getPassword() {
            return motDePasseHache;
        }

        @Override
        public String getUsername() {
            return email;
        }

        @Override
        public boolean isAccountNonExpired() {
            return true;
        }

        @Override
        public boolean isAccountNonLocked() {
            return true;
        }

        @Override
        public boolean isCredentialsNonExpired() {
            return true;
        }

        @Override
        public boolean isEnabled() {
            return true;
        }
    }
}
