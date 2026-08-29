package com.iozycore.domain.share;


import java.util.UUID;

/**
 * Le partage d'un espace personnel : <b>un lien, plusieurs sections</b>.
 * <p>
 * Il y avait auparavant deux systèmes parallèles - {@code CollectionShareSettings}
 * et {@code WishlistShareSettings} - avec chacun sa table, son jeton, son
 * contrôleur public, sa page et sa section de réglages. Deux liens à
 * distribuer, deux fois les mêmes règles écrites, et pour la personne qui
 * reçoit : deux URL pour regarder le même espace. Or ma collection et mes
 * envies sont deux <b>vues</b> de cet espace, pas deux espaces.
 * <p>
 * Le jeton fait office de mot de passe (capability URL) : le posséder suffit,
 * il n'y a rien d'autre à présenter. {@code token} nul = aucun lien actif, et
 * la révocation remet le champ à null plutôt que de conserver une ligne
 * « désactivée » - un jeton qui n'existe plus nulle part ne peut pas fuiter.
 * Régénérer invalide donc l'ancien du même geste.
 * <p>
 * <b>Au moins une section visible.</b> Un lien qui n'expose rien n'est pas un
 * partage plus discret, c'est une URL active vers une page vide : l'invariant
 * est refusé ici, dans le domaine, pas seulement dans un formulaire.
 * <p>
 * {@code includeTierLists} reste une sous-option de la collection, et
 * volontairement fausse par défaut y compris à la création d'un lien : un
 * classement personnel est un jugement, pas un inventaire, il ne part jamais
 * avec le reste sans avoir été demandé à part.
 */
public record ShareSettings(UUID ownerId, String token, boolean shareCollection, boolean shareWishlist,
                             boolean includeTierLists) {

    public ShareSettings {
        if (token != null && !shareCollection && !shareWishlist) {
            throw new IllegalArgumentException(
                    "Un lien actif doit exposer au moins une section - sinon il faut le supprimer");
        }
    }

    /** Aucun lien. Les sections restent à leur valeur la plus ouverte pour le prochain lien créé. */
    public static ShareSettings noLink(UUID proprietaire) {
        return new ShareSettings(proprietaire, null, true, true, false);
    }

    /**
     * Un lien tout neuf, les deux sections visibles et les Tier Lists exclues.
     * <p>
     * Le jeton est un UUID v4, tiré d'un générateur cryptographique : ni
     * séquentiel, ni dérivé de l'identifiant du propriétaire, et hors de portée
     * d'une énumération ({@code /share/1}, {@code /share/2}…). C'est le
     * mécanisme déjà en place dans le projet, conservé tel quel.
     */
    public static ShareSettings withNewToken(UUID proprietaire) {
        return new ShareSettings(proprietaire, UUID.randomUUID().toString(), true, true, false);
    }

    /**
     * Change les sections visibles <b>sans toucher au jeton</b> : le lien déjà
     * envoyé continue de fonctionner, il montre simplement autre chose.
     *
     * @throws IllegalArgumentException si les deux sections sont décochées alors qu'un lien est actif
     */
    public ShareSettings withSections(boolean shareCollection, boolean shareWishlist) {
        return new ShareSettings(ownerId, token, shareCollection, shareWishlist, includeTierLists);
    }

    /** Bascule les Tier Lists sans casser le lien déjà distribué. */
    public ShareSettings withTierLists(boolean includeTierLists) {
        return new ShareSettings(ownerId, token, shareCollection, shareWishlist, includeTierLists);
    }

    public boolean hasLink() {
        return token != null;
    }

    /**
     * Les trois accesseurs ci-dessous répondent à la seule question qui compte
     * côté public : « est-ce que ce visiteur a le droit de voir ça ? ». Ils
     * exigent tous un lien actif, pour qu'un drapeau resté à vrai sur une ligne
     * sans jeton n'expose jamais rien.
     */
    public boolean sharesCollection() {
        return hasLink() && shareCollection;
    }

    public boolean sharesWishlist() {
        return hasLink() && shareWishlist;
    }

    /** Les classements accompagnent la collection : sans elle, ils ne sortent pas. */
    public boolean sharesTierLists() {
        return sharesCollection() && includeTierLists;
    }
}
