package com.iozycore.insights;

import java.util.List;

/**
 * Statistiques agrégées de la collection (UC6 de la conception, Bounded
 * Context Insights). Calculées à la demande par requêtes d'agrégation
 * directes, pas via un modèle de lecture événementiel séparé - à l'échelle
 * d'une collection personnelle, la ceremony d'un vrai read-model
 * événementiel n'apporterait rien (voir étape 8 : le choix d'un
 * event-sourcing complet avait déjà été écarté comme disproportionné).
 */
public record StatsSummary(
        long totalEntities,
        long totalActiveOwnerships,
        long wishlistCount,
        long experiencesThisYear,
        List<TypeStats> byType,
        List<TagCount> topTags
) {
    public record TypeStats(
            String entityTypeCode,
            String entityTypeLabel,
            long entityCount,
            long activeOwnershipCount,
            long experienceCount,
            Double averageRating
    ) {
    }

    public record TagCount(String label, long count) {
    }

    /**
     * Un mois de la "Évolution de ma collection" (voir StatsService.computeTimeline) -
     * comptages uniquement, jamais de valeur monétaire : aucun champ de prix d'achat
     * n'existe encore sur Ownership (voir purchaseanalysis, qui porte les prix
     * mais uniquement pour des annonces analysées, pas pour la collection possédée).
     */
    public record MonthlyPoint(String month, long tomesAdded) {
    }
}
