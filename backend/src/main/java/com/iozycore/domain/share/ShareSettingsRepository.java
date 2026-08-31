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

}
