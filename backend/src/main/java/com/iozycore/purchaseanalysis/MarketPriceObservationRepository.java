package com.iozycore.purchaseanalysis;

import java.util.List;
import java.util.UUID;

/** Port for the append-only {@link MarketPriceObservation} log - see {@link MarketPriceObservation} for why this is the only source of observed prices in Phase 1. */
public interface MarketPriceObservationRepository {

    MarketPriceObservation save(MarketPriceObservation observation);

    List<MarketPriceObservation> findByEditionId(UUID mangaEditionId);

    /**
     * Combien de relevés se réfèrent à cette édition, <b>tous comptes
     * confondus</b>.
     *
     * <p>Seule question de ce dépôt qui ignore délibérément le cloisonnement,
     * parce qu'elle n'est pas une question de propriété mais d'intégrité :
     * les éditions de référence sont PARTAGÉES, et en supprimer une que les
     * relevés d'un autre compte utilisent encore casserait ses analyses. Sans
     * ce compte global, le refus poli laisserait place à une violation de clé
     * étrangère - une erreur de base de données affichée à quelqu'un qui n'a
     * rien fait de mal.
     */
    int countByEditionIdAllOwners(UUID mangaEditionId);

    /**
     * Tout le journal, pour l'export complet - un relevé saisi a la main est
     * irrecuperable ailleurs, et l'export promet l'absence d'enfermement
     * (meme raison que les editions de reference au Lot 33). Une methode
     * plutot qu'une boucle par edition cote appelant : l'export n'a aucune
     * raison d'emettre une requete par edition.
     */
    List<MarketPriceObservation> findAll();

    /**
     * Retire un relevé saisi par erreur (une virgule mal placée, la mauvaise
     * édition). C'est la SEULE écriture offerte en plus de l'ajout : un relevé
     * est un fait constaté à une date, pas un champ qu'on ajuste. Le corriger
     * après coup réécrirait une observation passée, et donc les analyses qui
     * s'appuient dessus ; on retire le relevé faux et on en enregistre un juste.
     * <p>
     * Idempotent, comme les autres suppressions de données utilisateur du projet.
     */
    void deleteById(UUID id);
}
