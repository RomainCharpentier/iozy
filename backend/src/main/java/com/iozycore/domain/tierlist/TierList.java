package com.iozycore.domain.tierlist;

import com.iozycore.domain.shared.DefaultOwner;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Racine d'agrégat représentant un classement personnalisé (voir la
 * maquette V1.2, "Nouvelle Tier List" - nom, univers/type, rangs actifs,
 * description optionnelle). Rattachée à UN SEUL EntityType (univers) dans
 * le cas courant - le classement GÉNÉRAL applique d'ailleurs toujours cette
 * règle (voir EntityRank : "Mangas" et "Jeux vidéo" ont chacun leur
 * échelle).
 * <p>
 * {@code entityTypeId} null = Tier List TRANSVERSE, "toutes catégories"
 * (scope 'all' de la maquette) : elle accepte des œuvres de n'importe quel
 * univers. C'est le seul cas où mélanger est voulu, et il est toujours
 * explicite - jamais le défaut d'une liste dont on aurait oublié l'univers
 * (voir le champ dédié de CreateTierListModal côté web).
 * <p>
 * Le classement GÉNÉRAL (un rang par œuvre, toujours sur l'échelle
 * complète S-F) n'est PAS une TierList : voir EntityRank, plus simple
 * (chaque entité possédée est un candidat implicite, pas besoin d'un ajout
 * explicite comme ici). Cette classe ne couvre que les Tier Lists
 * personnalisées, dont l'appartenance est toujours volontaire (voir
 * TierListItem).
 * <p>
 * Porte un ownerId (DefaultOwner.ID tant qu'aucun vrai système
 * multi-utilisateur n'existe) - même préparation que Ownership.
 */
public class TierList {

    private final UUID id;
    private final UUID ownerId;
    private String name;
    private final UUID entityTypeId;
    private Set<Rank> activeRanks;
    private String description;
    private final Instant createdAt;

    private TierList(UUID id, UUID ownerId, String name, UUID entityTypeId, Set<Rank> activeRanks,
                      String description, Instant createdAt) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Le nom de la Tier List ne peut pas être vide");
        }
        if (activeRanks == null || activeRanks.isEmpty()) {
            throw new IllegalArgumentException("Une Tier List doit avoir au moins un rang actif");
        }
        this.id = id;
        this.ownerId = ownerId;
        this.name = name;
        this.entityTypeId = entityTypeId;
        this.activeRanks = EnumSet.copyOf(activeRanks);
        this.description = description;
        this.createdAt = createdAt;
    }

    /** Rangs actifs par défaut = l'échelle complète (voir la maquette - une
     * Tier List personnalisée peut ensuite en désactiver certains, jamais
     * l'inverse d'un défaut vide).
     *
     * @param entityTypeId univers de la liste, {@code null} pour une liste
     *                     transverse "toutes catégories" (voir javadoc de classe). */
    public static TierList create(String name, UUID entityTypeId, Set<Rank> activeRanks, String description) {
        Set<Rank> ranks = (activeRanks == null || activeRanks.isEmpty()) ? EnumSet.allOf(Rank.class) : activeRanks;
        return new TierList(UUID.randomUUID(), DefaultOwner.ID, name.trim(), entityTypeId, ranks,
                blankToNull(description), Instant.now());
    }

    public static TierList reconstitute(UUID id, UUID ownerId, String name, UUID entityTypeId, Set<Rank> activeRanks,
                                         String description, Instant createdAt) {
        return new TierList(id, ownerId, name, entityTypeId, activeRanks, description, createdAt);
    }

    public void rename(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Le nom de la Tier List ne peut pas être vide");
        }
        this.name = name.trim();
    }

    public void updateActiveRanks(Set<Rank> activeRanks) {
        if (activeRanks == null || activeRanks.isEmpty()) {
            throw new IllegalArgumentException("Une Tier List doit avoir au moins un rang actif");
        }
        this.activeRanks = EnumSet.copyOf(activeRanks);
    }

    public void updateDescription(String description) {
        this.description = blankToNull(description);
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    public UUID id() {
        return id;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public String name() {
        return name;
    }

    /** Vide = Tier List transverse "toutes catégories" (voir javadoc de classe). */
    public Optional<UUID> entityTypeId() {
        return Optional.ofNullable(entityTypeId);
    }

    /** Toutes catégories confondues - une œuvre de n'importe quel univers peut y entrer. */
    public boolean isAllUniverses() {
        return entityTypeId == null;
    }

    public Set<Rank> activeRanks() {
        return EnumSet.copyOf(activeRanks);
    }

    public Optional<String> description() {
        return Optional.ofNullable(description);
    }

    public Instant createdAt() {
        return createdAt;
    }
}
