package com.iozycore.domain.shared;

import java.util.UUID;

/**
 * IozyCore reste mono-utilisateur en pratique aujourd'hui, mais chaque
 * Ownership/Experience/WishlistEntry porte désormais un ownerId dès sa
 * création (voir conception : préparation au multi-utilisateur, option B).
 * <p>
 * Tant qu'aucun système d'authentification multi-utilisateur n'existe,
 * tout est rattaché à ce propriétaire par défaut - un UUID nul choisi par
 * convention plutôt qu'un ownerId nullable, pour ne jamais avoir à gérer
 * de cas "sans propriétaire" dans le code applicatif.
 * <p>
 * Le jour où un vrai système d'utilisateurs est introduit, il suffit de
 * cesser d'utiliser cette constante à la création et de migrer les lignes
 * existantes vers de vrais ownerId - aucune colonne à ajouter, aucun
 * changement de schéma.
 */
public final class DefaultOwner {

    public static final UUID ID = UUID.fromString("00000000-0000-0000-0000-000000000000");

    private DefaultOwner() {
    }
}
