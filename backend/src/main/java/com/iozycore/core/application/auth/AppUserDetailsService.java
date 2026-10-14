package com.iozycore.core.application.auth;

import com.iozycore.core.domain.user.AppUser;
import com.iozycore.core.domain.user.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * The bridge between the accounts of the application and Spring Security.
 *
 * <p>The principal that comes out carries the {@link AppUser#id()}: it is THIS that
 * the application will read to know who owns what is written (see
 * {@link UtilisateurCourant}). A principal reduced to an e-mail address
 * would force each write to reopen the accounts table.
 */
@Service
@RequiredArgsConstructor
public class AppUserDetailsService implements UserDetailsService {

    /** The only role of this application. It gives access to nothing of the data
     *  of others - only to the administration of the instance (see V28). */
    private static final List<org.springframework.security.core.GrantedAuthority> ADMINISTRATEUR =
            List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"));

    /** The usual case: an ordinary account, which can do everything on ITS collection. */
    private static final List<org.springframework.security.core.GrantedAuthority> AUCUN_ROLE = List.of();

    private final AppUserRepository comptes;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        AppUser compte = comptes.findByEmail(AppUser.normaliserEmail(email))
                .orElseThrow(() -> new UsernameNotFoundException("Compte inconnu"));
        return new Principal(compte.id(), compte.email(), compte.passwordHash(), compte.pseudo(), compte.admin());
    }

    /**
     * What the session keeps of an account: enough to know who writes, and nothing
     * more. The hash is there because Spring Security compares the given
     * password with it; it never goes out to a client (see
     * {@code AuthController}, which returns an explicit view of the account).
     */
    public record Principal(UUID id, String email, String motDePasseHache, String pseudo, boolean admin)
            implements UserDetails {

        @Override
        public List<org.springframework.security.core.GrantedAuthority> getAuthorities() {
            return admin ? ADMINISTRATEUR : AUCUN_ROLE;
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
