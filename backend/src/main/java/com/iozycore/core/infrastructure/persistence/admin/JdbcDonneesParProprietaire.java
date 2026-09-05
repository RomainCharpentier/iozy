package com.iozycore.core.infrastructure.persistence.admin;

import com.iozycore.core.application.admin.DonneesParProprietaire;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Le compte et l'effacement, en SQL direct.
 *
 * <h2>Pourquoi pas JPA</h2>
 * Les entités portent {@code @TenantId} : toute lecture passée par un dépôt
 * JPA est filtrée sur le propriétaire COURANT. C'est exactement ce qu'on veut
 * partout ailleurs, et exactement ce qui rend ces deux gestes impossibles à
 * écrire ainsi. Le SQL est donc assumé et confiné ici (voir
 * {@link DonneesParProprietaire} pour le raisonnement complet).
 *
 * <h2>La liste des tables est écrite à la main, et c'est voulu</h2>
 * On pourrait la déduire du schéma (« toute table portant {@code owner_id} »).
 * Une suppression définitive ne doit pas dépendre d'une découverte : une table
 * ajoutée demain serait effacée sans que personne ne l'ait décidé, et une
 * table renommée disparaîtrait de la liste sans un mot. Écrite ici, elle
 * casse au premier test si elle se périme.
 */
@Repository
public class JdbcDonneesParProprietaire implements DonneesParProprietaire {

    /**
     * Les onze tables cloisonnées par propriétaire, filles d'abord.
     * <p>
     * {@code tier_list_item} avant {@code tier_list} : c'est la seule clé
     * étrangère entre deux tables de cette liste. Le reste est indépendant.
     */
    private static final List<String> TABLES_PRIVEES = List.of(
            "tier_list_item",
            "tier_list",
            "ownership",
            "experience",
            "wishlist_entry",
            "entity_rank",
            "followed_edition",
            "collector_preferences",
            "share_settings",
            "purchase_analysis",
            "market_price_observation");

    /**
     * Cinq décomptes, une seule requête.
     * <p>
     * Les cinq retenus sont ceux qui décrivent une collection à quelqu'un qui
     * doit décider de la détruire. Les six autres tables sont supprimées comme
     * les autres, mais ne sont pas comptées : « 3 préférences de collectionneur »
     * n'aide personne à trancher.
     */
    private static final String COMPTAGE = """
            SELECT owner_id, 'possessions' AS quoi, count(*) AS combien FROM ownership GROUP BY owner_id
            UNION ALL SELECT owner_id, 'envies', count(*) FROM wishlist_entry GROUP BY owner_id
            UNION ALL SELECT owner_id, 'experiences', count(*) FROM experience GROUP BY owner_id
            UNION ALL SELECT owner_id, 'classements', count(*) FROM tier_list GROUP BY owner_id
            UNION ALL SELECT owner_id, 'analyses', count(*) FROM purchase_analysis GROUP BY owner_id
            """;

    private final JdbcTemplate jdbc;

    public JdbcDonneesParProprietaire(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Map<UUID, Volume> compter() {
        Map<UUID, long[]> parProprietaire = new HashMap<>();
        jdbc.query(COMPTAGE, resultat -> {
            UUID proprietaire = resultat.getObject("owner_id", UUID.class);
            long[] lignes = parProprietaire.computeIfAbsent(proprietaire, ignore -> new long[5]);
            lignes[indiceDe(resultat.getString("quoi"))] = resultat.getLong("combien");
        });

        Map<UUID, Volume> volumes = new HashMap<>();
        parProprietaire.forEach((proprietaire, lignes) ->
                volumes.put(proprietaire, new Volume(lignes[0], lignes[1], lignes[2], lignes[3], lignes[4])));
        return volumes;
    }

    private static int indiceDe(String quoi) {
        return switch (quoi) {
            case "possessions" -> 0;
            case "envies" -> 1;
            case "experiences" -> 2;
            case "classements" -> 3;
            case "analyses" -> 4;
            // Injoignable tant que la requête ci-dessus et ce switch parlent de
            // la même chose - et c'est justement pour qu'ils continuent d'en
            // parler que ce cas échoue au lieu de rendre 0 en silence.
            default -> throw new IllegalStateException("Décompte inconnu : " + quoi);
        };
    }

    @Override
    @Transactional
    public void effacerToutCeQuiAppartientA(UUID proprietaire) {
        // Une seule transaction : un effacement à moitié fait laisserait un
        // compte supprimé dont les possessions survivent, invisibles pour
        // toujours - plus personne ne porte cet identifiant.
        for (String table : TABLES_PRIVEES) {
            jdbc.update("DELETE FROM " + table + " WHERE owner_id = ?", proprietaire);
        }
    }
}
