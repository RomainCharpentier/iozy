package com.iozycore.core.api.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Le partage d'espace, côté propriétaire et côté visiteur.
 *
 * <h2>Ce que la vue publique n'expose délibérément pas</h2>
 * Aucun identifiant (entityId, variantId, tierListId…) ni lien profond : le
 * porteur du lien ne doit pouvoir atteindre que cette page, jamais le reste de
 * l'application. Aucun prix payé, aucune valeur estimée, aucune date
 * d'acquisition, aucune note ni commentaire personnel, aucun tag, aucune
 * relation, aucun historique, aucune analyse d'achat, aucun prix relevé.
 * Aucune information de compte non plus - il n'existe d'ailleurs ni pseudo ni
 * avatar dans le modèle, et cette passe n'en invente pas.
 * <p>
 * C'est le <b>backend</b> qui filtre : ces enregistrements sont construits
 * champ par champ à partir du domaine, jamais un modèle interne sérialisé tel
 * quel qu'un client masquerait ensuite. Toute addition ici doit refaire ce
 * raisonnement.
 */
public final class ShareDtos {

    private ShareDtos() {
    }

    /** État du lien côté propriétaire - {@code token} null = aucun lien actif. */
    public record ShareResponse(String token, boolean shareCollection, boolean shareWishlist,
                                 boolean includeTierLists) {
    }

    /**
     * Modification des sections visibles. Chaque champ est facultatif :
     * {@code null} = « ne change pas », ce qui permet à l'écran Envies de ne
     * toucher qu'aux envies sans rien savoir de la collection.
     */
    public record UpdateShareRequest(Boolean shareCollection, Boolean shareWishlist, Boolean includeTierLists) {
    }

    /**
     * Ce qu'un visiteur reçoit. Les sections non partagées sont <b>absentes</b>
     * ({@code null}), pas vides : une section vide dirait « partagée, mais rien
     * dedans », ce qui est une information différente - et le client n'a alors
     * même pas de quoi afficher un onglet inaccessible.
     */
    public record SharedSpaceResponse(List<SharedUniverse> collection, List<SharedWishlistItem> wishlist,
                                       SharedTierLists tierLists) {
    }

    public record SharedUniverse(String label, List<SharedCollectionItem> items) {
    }

    /**
     * @param editions         éditions réellement possédées de cette œuvre (souvent une seule,
     *                         vide quand aucune n'est renseignée)
     * @param ownedVolumeCount nombre de tomes DISTINCTS possédés - 0 pour une œuvre possédée
     *                         sans tome précis (jeu, one-shot sans numéro)
     * @param totalVolumes     total connu de la série, null si inconnu : la progression n'est
     *                         alors pas affichée plutôt que devinée
     */
    public record SharedCollectionItem(String title, String coverImageUrl, List<String> editions,
                                        int ownedVolumeCount, Integer totalVolumes) {
    }

    /** Une envie : de quoi la reconnaître pour l'offrir, rien de plus. */
    public record SharedWishlistItem(String title, String coverImageUrl, LocalDate addedAt) {
    }

    /** @param general classement général par univers ; @param custom Tier Lists nommées. */
    public record SharedTierLists(List<SharedTierBoard> general, List<SharedTierBoard> custom) {
    }

    public record SharedTierBoard(String label, List<SharedTierRow> rows) {
    }

    public record SharedTierRow(String rank, List<SharedRankedItem> items) {
    }

    public record SharedRankedItem(String title, String coverImageUrl) {
    }
}
