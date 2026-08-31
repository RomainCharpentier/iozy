package com.iozycore.application.auth;

import com.iozycore.domain.share.ShareSettingsRepository;
import com.iozycore.domain.user.AppUser;
import com.iozycore.domain.user.AppUserRepository;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Entrer sans compte, quand quelqu'un a laissé sa porte ouverte.
 *
 * <h2>C'est l'instance qui désigne la collection, jamais le visiteur</h2>
 * Un visiteur anonyme n'a rien à présenter et ne demande rien de précis : il
 * appuie sur « Visiter », et l'instance répond par LA collection visitable, ou
 * par un refus. Laisser passer un identifiant dans la requête aurait fait de
 * cette porte un moyen de deviner qui habite l'instance - il aurait suffi
 * d'essayer des identifiants jusqu'à ce que l'un réponde.
 *
 * <h2>Le PREMIER compte, et ouvert sans rien avoir à faire</h2>
 * La collection visitable est celle du compte le plus ancien : celui qui a
 * déployé l'instance et repris la collection d'origine (voir
 * {@code AppUser.premier}). C'est la seule réponse qui soit toujours la même -
 * sans quoi deux visiteurs verraient deux collections selon l'ordre des lignes.
 *
 * <p>Elle est ouverte <b>par défaut</b>. La porte a d'abord demandé une case à
 * cocher, et c'était une étape de trop : on veut qu'un inconnu qui arrive sur
 * l'écran de connexion puisse entrer, pas qu'il attende que quelqu'un l'y
 * autorise. La case existe toujours, mais en sens inverse - elle sert à
 * <b>refermer</b> (voir {@code ShareSettings.openToGuests}, vrai par défaut).
 *
 * <h2>Ce qui ferme quand même</h2>
 * Aucun compte sur l'instance, ou le premier compte a décoché la case :
 * {@link #commencer()} rend vide, et personne n'entre.
 */
@Service
public class Visite {

    /**
     * Le rôle d'un visiteur. Il ne donne accès à rien de plus qu'un compte
     * ordinaire - il en RETIRE : c'est lui que la chaîne de sécurité reconnaît
     * pour refuser toute écriture (voir {@code SecurityConfig}).
     */
    public static final String ROLE = "ROLE_INVITE";

    public static final List<GrantedAuthority> AUTORITES = List.of(new SimpleGrantedAuthority(ROLE));

    private final ShareSettingsRepository espaces;
    private final AppUserRepository comptes;

    public Visite(ShareSettingsRepository espaces, AppUserRepository comptes) {
        this.espaces = espaces;
        this.comptes = comptes;
    }

    /** Y a-t-il une collection à visiter ? La question que pose l'écran de connexion. */
    public boolean ouverte() {
        return commencer().isPresent();
    }

    /**
     * Cette visite-ci a-t-elle encore lieu d'être ?
     *
     * <h2>Pourquoi la question se repose à chaque requête</h2>
     * Une session de visite porte la collection qu'elle parcourt, et elle la
     * porterait indéfiniment : refermer la porte n'aurait délogé personne, et
     * les visiteurs déjà entrés auraient continué de lire jusqu'à expiration de
     * leur session - c'est-à-dire pendant que son propriétaire croit avoir
     * refermé. Décocher la case doit reprendre l'accès <b>tout de suite</b>,
     * sinon ce n'est pas une case, c'est un vœu.
     *
     * <p>Le coût est une lecture par requête de visite, sur un index dédié et
     * une table d'une ligne par compte. Les visiteurs sont rares, et c'est
     * exactement le genre de prix qu'on paie pour que « fermé » veuille dire
     * fermé.
     *
     * <p>Comparer le PROPRIÉTAIRE et pas seulement l'existence d'une porte
     * ouverte : si la collection visitable venait à changer - un premier compte
     * supprimé, par exemple - la session en cours ne doit pas basculer en
     * silence sur une collection que son visiteur n'a jamais demandé à voir.
     */
    public boolean encoreOuverteChez(UUID proprietaire) {
        return commencer().map(Invite::proprietaire).filter(proprietaire::equals).isPresent();
    }

    /**
     * Le visiteur à installer dans la session, si une collection est visitable.
     * <p>
     * On part du COMPTE, et non de ses réglages de partage. L'ordre compte :
     * partir des réglages ferait dépendre la visite de l'existence d'une ligne
     * en base, donc du fait que quelqu'un ait un jour touché à cet écran - et
     * une ligne orpheline, restée derrière un compte supprimé, aurait ouvert
     * une collection qui n'existe plus. Partir du compte rend les deux cas
     * impossibles : pas de compte, pas de visite.
     * <p>
     * Le réglage n'intervient qu'ensuite, et seulement pour <b>refermer</b>
     * (voir {@code ShareSettings.noLink}, ouvert par défaut).
     */
    public Optional<Invite> commencer() {
        return hote()
                .filter(hote -> espaces.pour(hote.id()).openToGuests())
                .map(hote -> new Invite(hote.id(), hote.pseudo()));
    }

    /**
     * Le compte le plus ancien, celui dont la collection se visite.
     * <p>
     * {@code lister()} rend les comptes du plus ancien au plus récent, et c'est
     * exactement l'ordre qu'il faut ici. Sur une instance vide, il n'y a
     * personne à visiter - et rien à montrer non plus.
     */
    private Optional<AppUser> hote() {
        return comptes.lister().stream().findFirst();
    }
}
