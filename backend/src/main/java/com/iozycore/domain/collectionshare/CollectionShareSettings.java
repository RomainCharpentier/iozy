package com.iozycore.domain.collectionshare;

import com.iozycore.domain.shared.DefaultOwner;

import java.util.UUID;

/**
 * "Partager ma collection" (voir la maquette V1.2, Profil) - un seul lien à
 * la fois pour toute la collection, même mécanique de capability URL que
 * {@link com.iozycore.domain.wishlist.WishlistShareSettings} : {@code token}
 * nul = aucun lien actif, la suppression remet le champ à null plutôt que
 * de garder une ligne "désactivée" (un jeton qui n'existe plus nulle part ne
 * peut pas fuiter), et régénérer invalide silencieusement l'ancien.
 * <p>
 * Domaine DISTINCT du partage de wishlist, jamais une extension de
 * celui-ci : les deux liens s'activent, se révoquent et se régénèrent
 * indépendamment - partager ce qu'on cherche et partager ce qu'on possède
 * sont deux décisions différentes, et fusionner les deux jetons ferait
 * qu'en révoquer un révoquerait l'autre.
 * <p>
 * {@code includeTierLists} : second geste explicite, faux par défaut y
 * compris à la création d'un lien (voir {@link #withNewToken()}). Un
 * classement personnel est un jugement, pas un inventaire - il ne part
 * jamais avec la collection sans avoir été demandé à part (voir la maquette,
 * switch "partager aussi mes Tier Lists"). Couper le lien remet aussi ce
 * drapeau à faux : un nouveau lien repart toujours du choix le plus fermé.
 */
public record CollectionShareSettings(UUID ownerId, String token, boolean includeTierLists) {

    public static CollectionShareSettings noLink() {
        return new CollectionShareSettings(DefaultOwner.ID, null, false);
    }

    public static CollectionShareSettings withNewToken() {
        return new CollectionShareSettings(DefaultOwner.ID, UUID.randomUUID().toString(), false);
    }

    /** Bascule le partage des Tier Lists SANS toucher au jeton - l'interrupteur
     * de la maquette ne doit jamais casser le lien déjà distribué. */
    public CollectionShareSettings withTierLists(boolean includeTierLists) {
        return new CollectionShareSettings(ownerId, token, includeTierLists);
    }

    public boolean hasLink() {
        return token != null;
    }

    /** Vrai seulement si un lien est actif ET que les classements ont été
     * explicitement inclus - un drapeau resté à vrai sur une ligne sans jeton
     * ne doit rien exposer. */
    public boolean sharesTierLists() {
        return hasLink() && includeTierLists;
    }
}
