package com.iozycore.manga.domain.followededition;


import java.time.LocalDate;
import java.util.UUID;

/**
 * L'édition d'une série que l'utilisateur collectionne réellement - le badge
 * « SUIVIE » de la maquette « Fiche série (multi-éditions) ».
 * <p>
 * À ne pas confondre avec {@code MangaEdition} = la fiche documentaire d'une
 * édition (éditeur, nombre de tomes, épuisée...). Elle décrit l'édition pour
 * tout le monde ; celle-ci dit ce que MOI j'en fais.
 * <p>
 * Désigne l'édition par son NOM, jamais par l'id d'une {@code MangaEdition} :
 * une série peut avoir des tomes dans une édition qui n'a encore aucune fiche
 * documentaire (elle n'est créée qu'au moment où on renseigne éditeur/nombre
 * de tomes). Suivre une édition ne doit pas exiger de l'avoir d'abord
 * documentée.
 * <p>
 * Porte un ownerId, mais ne le CHOISIT pas : null à la création, la session
 * tranche à l'écriture via la colonne marquée @TenantId (voir
 * ProprietaireCourant). Même règle que Ownership.
 */
public class FollowedEdition {

    private final UUID id;
    private final UUID entityId;
    private final UUID ownerId;
    private final String editionName;
    private final LocalDate followedAt;

    private FollowedEdition(UUID id, UUID entityId, UUID ownerId, String editionName, LocalDate followedAt) {
        if (editionName == null || editionName.isBlank()) {
            // Suivre « l'édition non précisée » ne veut rien dire : c'est le
            // fourre-tout des tomes dont l'édition est inconnue, pas une
            // édition qu'on peut décider de collectionner. Garde AVANT le trim
            // ci-dessous, pour qu'un corps sans nom ressorte en 400 plutôt
            // qu'en 500.
            throw new IllegalArgumentException("L'édition suivie ne peut pas être vide");
        }
        this.id = id;
        this.entityId = entityId;
        this.ownerId = ownerId;
        this.editionName = editionName.trim();
        this.followedAt = followedAt;
    }

    public static FollowedEdition create(UUID entityId, String editionName) {
        return new FollowedEdition(UUID.randomUUID(), entityId, null, editionName, LocalDate.now());
    }

    public static FollowedEdition reconstitute(UUID id, UUID entityId, UUID ownerId, String editionName,
                                               LocalDate followedAt) {
        return new FollowedEdition(id, entityId, ownerId, editionName, followedAt);
    }

    /**
     * Change l'édition suivie en gardant la même identité de ligne - c'est ce
     * qui fait respecter « une seule édition suivie par série » sans jamais
     * dépendre d'un DELETE puis d'un INSERT, qui laisserait une fenêtre où la
     * série n'en a aucune (et violerait la contrainte d'unicité si les deux
     * ordres se croisaient).
     */
    public FollowedEdition suivreALaPlace(String nouvelleEdition) {
        return new FollowedEdition(id, entityId, ownerId, nouvelleEdition, LocalDate.now());
    }

    public UUID id() {
        return id;
    }

    public UUID entityId() {
        return entityId;
    }

    public UUID ownerId() {
        return ownerId;
    }

    public String editionName() {
        return editionName;
    }

    public LocalDate followedAt() {
        return followedAt;
    }
}
