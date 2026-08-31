package com.iozycore.domain.share;

import java.util.Optional;

/**
 * Port du partage d'espace. Une seule ligne (application mono-utilisateur, voir
 * {@link com.iozycore.domain.shared.DefaultOwner}), donc {@link #find()} sans
 * argument, comme les autres réglages du projet.
 */
public interface ShareSettingsRepository {

    /** Les réglages courants, ou l'état « aucun lien » si rien n'a jamais été créé. */
    ShareSettings find();

    ShareSettings save(ShareSettings settings);

    /**
     * Le seul point d'entrée de la lecture publique : résout un jeton, ou rien.
     * Un jeton nul, vide ou révoqué ne doit JAMAIS retomber sur la ligne du
     * propriétaire (dont le champ token vaut null une fois le lien supprimé).
     */
    Optional<ShareSettings> findByToken(String token);

    /**
     * L'espace qui a laissé ses portes ouvertes aux visiteurs, s'il y en a un.
     *
     * <h2>Pourquoi « le premier » et non « tous »</h2>
     * Un visiteur anonyme n'a rien à présenter : il ne peut pas dire QUELLE
     * collection il vient voir, et lui faire choisir dans une liste de comptes
     * dirait à n'importe qui qui habite l'instance. La question n'a donc qu'une
     * réponse possible, et il faut qu'elle soit toujours la même - sans quoi
     * deux visiteurs verraient deux collections différentes selon l'humeur du
     * plan d'exécution.
     *
     * <p>L'ordre retenu est celui de l'identifiant, ce qui fait gagner le
     * <b>premier compte</b> quand il a ouvert : le sien vaut
     * {@link com.iozycore.domain.shared.DefaultOwner#ID}, seize octets à zéro,
     * qui passe avant tout identifiant tiré au hasard. C'est la personne qui a
     * déployé l'instance, et la collection qu'un visiteur s'attend à y trouver.
     */
    Optional<ShareSettings> premierOuvertAuxVisiteurs();
}
