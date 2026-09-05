package com.iozycore.core.application.auth;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

/**
 * Ce qu'est une visite, une fois qu'elle ne désigne plus personne.
 *
 * <h2>Il n'y a plus rien à décider</h2>
 * Cette classe a été un service, avec deux dépôts et trois questions : quelle
 * collection ouvrir, son propriétaire l'a-t-il autorisé, l'autorise-t-il
 * encore. Toutes ont disparu avec la réponse au vrai besoin - un visiteur
 * consulte le <b>catalogue</b>, qui n'appartient à personne. Il ne reste donc
 * que la déclaration d'un rôle, et c'est bien assez pour justifier un nom.
 *
 * <p>Aucun réglage ne l'ouvre ni ne la ferme : la visite est disponible parce
 * que le catalogue existe. Ce que le code ne sait plus faire ne peut pas être
 * mal réglé.
 */
public final class Visite {

    /**
     * Le rôle d'un visiteur. Il ne donne accès à rien de plus qu'un compte
     * ordinaire - il en RETIRE : c'est lui que la chaîne de sécurité reconnaît
     * pour refuser toute écriture (voir {@code SecurityConfig}).
     */
    public static final String ROLE = "ROLE_INVITE";

    public static final List<GrantedAuthority> AUTORITES = List.of(new SimpleGrantedAuthority(ROLE));

    private Visite() {
    }
}
