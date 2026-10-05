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
 * The count and the deletion, in direct SQL.
 *
 * <h2>Why not JPA</h2>
 * The entities carry {@code @TenantId}: every read through a JPA
 * repository is filtered on the CURRENT owner. This is exactly what we want
 * everywhere else, and exactly what makes these two actions impossible to
 * write that way. The SQL is therefore accepted and kept here (see
 * {@link DonneesParProprietaire} for the full reasoning).
 *
 * <h2>The list of tables is written by hand, on purpose</h2>
 * It could be deduced from the schema ("every table with {@code owner_id}").
 * A permanent deletion must not depend on a discovery: a table
 * added tomorrow would be erased without anyone deciding it, and a
 * renamed table would drop out of the list without a word. Written here, it
 * breaks at the first test if it gets out of date.
 */
@Repository
public class JdbcDonneesParProprietaire implements DonneesParProprietaire {

    /**
     * The eleven tables isolated by owner, children first.
     * <p>
     * {@code tier_list_item} before {@code tier_list}: it is the only foreign
     * key between two tables of this list. The rest is independent.
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
     * Five counts, one single query.
     * <p>
     * The five chosen are those that describe a collection to someone
     * who must decide to destroy it. The other six tables are deleted like
     * the others, but are not counted: "3 collector preferences"
     * helps nobody decide.
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
            // Unreachable as long as the query above and this switch talk about
            // the same thing - and it is exactly so that they keep talking about
            // it that this case fails instead of silently returning 0.
            default -> throw new IllegalStateException("Décompte inconnu : " + quoi);
        };
    }

    @Override
    @Transactional
    public void effacerToutCeQuiAppartientA(UUID proprietaire) {
        // One single transaction: a half-done deletion would leave a
        // deleted account whose possessions survive, invisible
        // forever - nobody carries that identifier anymore.
        for (String table : TABLES_PRIVEES) {
            jdbc.update("DELETE FROM " + table + " WHERE owner_id = ?", proprietaire);
        }
    }
}
