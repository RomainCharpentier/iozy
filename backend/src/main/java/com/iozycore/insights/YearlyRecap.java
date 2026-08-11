package com.iozycore.insights;

import java.util.List;

/**
 * "Bilan annuel" (Mon profil) - « 84 tomes achetés, 12 séries commencées,
 * auteur le plus présent... » sur une année donnée (voir
 * StatsService.computeYearlyRecap). Lecture pure au même titre que
 * StatsSummary/MonthlyPoint - pas d'endpoint public/non-authentifié : le
 * "partageable" se fait en téléchargeant l'image générée côté client
 * (voir web/CollectionRecapPage), jamais via un lien public exposant
 * directement les données du propriétaire (aucun système d'authentification
 * n'existe encore dans l'app pour distinguer "moi" de "n'importe qui").
 */
public record YearlyRecap(
        int year,
        long acquisitionsCount,
        List<TypeCount> acquisitionsByType,
        long seriesStartedCount,
        long experiencesCount,
        Double averageRating,
        String mostFeaturedCreator,
        long mostFeaturedCreatorCount,
        List<Integer> availableYears
) {
    public record TypeCount(String entityTypeLabel, long count) {
    }
}
