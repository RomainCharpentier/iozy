package com.iozycore.api.dto;

import java.util.List;

/**
 * Vue PUBLIQUE d'une collection partagée (voir PublicCollectionController) -
 * strictement ce que le propriétaire a accepté d'exposer, jamais un modèle
 * interne sérialisé tel quel.
 * <p>
 * Ce qui n'y est délibérément PAS : aucun identifiant (entityId, variantId,
 * tierListId...) ni lien profond vers l'app - le porteur du lien ne doit
 * pouvoir atteindre que cette page ; aucun prix d'achat, aucune valeur
 * estimée, aucune date d'acquisition ; aucune wishlist (elle a son propre
 * lien, révocable séparément). Toute addition ici doit refaire ce
 * raisonnement, comme l'avertissement déjà posé sur PublicWishlistController.
 */
public class CollectionShareDtos {

    /** État du lien côté propriétaire - {@code token} null = aucun lien actif. */
    public record CollectionShareResponse(String token, boolean includeTierLists) {
    }

    public record UpdateCollectionShareRequest(Boolean includeTierLists) {
    }

    /** @param tierLists null quand le propriétaire ne les partage PAS - distinct
     *                  d'une liste vide, qui signifierait "partagées, mais aucune". */
    public record SharedCollectionResponse(List<SharedUniverse> universes, SharedTierLists tierLists) {
    }

    public record SharedUniverse(String label, List<SharedCollectionItem> items) {
    }

    /**
     * @param editions          éditions réellement possédées de cette œuvre (souvent une seule,
     *                          vide quand aucune n'est renseignée)
     * @param ownedVolumeCount  nombre de tomes DISTINCTS possédés - 0 pour une œuvre possédée
     *                          sans tome précis (jeu, one-shot sans numéro)
     * @param totalVolumes      total connu de la série, null si inconnu : la progression n'est
     *                          alors pas affichée plutôt que devinée
     */
    public record SharedCollectionItem(String title, String coverImageUrl, List<String> editions,
                                        int ownedVolumeCount, Integer totalVolumes) {
    }

    /** @param general classement général par univers, @param custom Tier Lists nommées. */
    public record SharedTierLists(List<SharedTierBoard> general, List<SharedTierBoard> custom) {
    }

    public record SharedTierBoard(String label, List<SharedTierRow> rows) {
    }

    public record SharedTierRow(String rank, List<SharedRankedItem> items) {
    }

    public record SharedRankedItem(String title, String coverImageUrl) {
    }
}
