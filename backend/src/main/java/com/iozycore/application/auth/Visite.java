package com.iozycore.application.auth;

import com.iozycore.domain.share.ShareSettings;
import com.iozycore.domain.share.ShareSettingsRepository;
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
 * appuie sur « Visiter », et l'instance répond par LA collection ouverte, ou
 * par un refus. Laisser passer un identifiant dans la requête aurait fait de
 * cette porte un moyen de deviner qui habite l'instance - il aurait suffi
 * d'essayer des identifiants jusqu'à ce que l'un réponde.
 *
 * <h2>Fermé par défaut, et fermé quand on n'en sait rien</h2>
 * Aucun espace ouvert, ou un espace ouvert dont le compte a depuis été
 * supprimé : {@link #commencer()} rend vide, et personne n'entre. L'absence de
 * réponse claire ferme la porte, elle ne l'ouvre pas - c'est la même règle que
 * pour le code d'invitation non configuré (voir {@link AuthService}).
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
     * ouverte : si un autre compte a ouvert la sienne entre-temps, la session
     * en cours ne doit pas basculer en silence sur une collection que son
     * visiteur n'a jamais demandé à voir.
     */
    public boolean encoreOuverteChez(UUID proprietaire) {
        return espaces.premierOuvertAuxVisiteurs()
                .map(ShareSettings::ownerId)
                .filter(proprietaire::equals)
                .isPresent();
    }

    /**
     * Le visiteur à installer dans la session, si une collection est ouverte.
     * <p>
     * Le compte hôte est relu ici, et pas seulement ses réglages de partage :
     * c'est lui qui donne le pseudo à afficher, et son absence est en elle-même
     * une raison de refuser - une ligne de partage orpheline (compte supprimé,
     * ses réglages restés derrière) n'ouvre rien du tout.
     */
    public Optional<Invite> commencer() {
        return espaces.premierOuvertAuxVisiteurs()
                .map(ShareSettings::ownerId)
                .flatMap(comptes::findById)
                .map(hote -> new Invite(hote.id(), hote.pseudo()));
    }
}
