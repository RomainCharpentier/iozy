package com.iozycore.core.domain.catalog;

import com.iozycore.core.domain.shared.DomainEvent;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Racine d'agrégat représentant une œuvre/chose unique, indépendante de
 * sa possession, de ses expériences et de ses médias.
 * <p>
 * Invariant : le {@code entityTypeId} est fixé à la création et ne
 * change jamais — changer de type ferait perdre le sens des attributs
 * personnalisés (voir modèle de domaine, étape 7).
 */
public class Entity {

    private final UUID id;
    private final UUID entityTypeId;
    private String title;
    private final Map<String, Object> attributes = new HashMap<>();
    private final List<Variant> variants = new ArrayList<>();
    private final Set<UUID> tagIds = new HashSet<>();
    /** Les cles de {@link #attributes} saisies a la main (Lot 130) - voir {@link #saisirAttributs}. */
    private final Set<String> champsSaisis = new HashSet<>();
    private final List<DomainEvent> pendingEvents = new ArrayList<>();

    private Entity(UUID id, UUID entityTypeId, String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Le titre d'une Entity ne peut pas être vide");
        }
        this.id = id;
        this.entityTypeId = entityTypeId;
        this.title = title;
    }

    /** Crée une nouvelle Entity et enregistre l'événement {@link EntityCreated}. */
    public static Entity create(UUID entityTypeId, String title) {
        Entity entity = new Entity(UUID.randomUUID(), entityTypeId, title);
        entity.pendingEvents.add(new EntityCreated(entity.id, entityTypeId, title, Instant.now()));
        return entity;
    }

    /** Reconstruit une Entity depuis la persistance (aucun événement émis). */
    public static Entity reconstitute(UUID id, UUID entityTypeId, String title,
                                       Map<String, Object> attributes, List<Variant> variants, Set<UUID> tagIds) {
        return reconstitute(id, entityTypeId, title, attributes, variants, tagIds, Set.of());
    }

    /** Idem, avec les champs saisis a la main (Lot 130). */
    public static Entity reconstitute(UUID id, UUID entityTypeId, String title,
                                       Map<String, Object> attributes, List<Variant> variants, Set<UUID> tagIds,
                                       Set<String> champsSaisis) {
        Entity entity = new Entity(id, entityTypeId, title);
        entity.attributes.putAll(attributes);
        entity.variants.addAll(variants);
        entity.tagIds.addAll(tagIds);
        entity.champsSaisis.addAll(champsSaisis);
        return entity;
    }

    public void rename(String newTitle) {
        if (newTitle == null || newTitle.isBlank()) {
            throw new IllegalArgumentException("Le titre d'une Entity ne peut pas être vide");
        }
        this.title = newTitle;
    }

    public void setAttribute(String key, Object value) {
        attributes.put(key, value);
    }

    /**
     * Complète/corrige les attributs de la Série elle-même sans écraser ceux
     * non concernés - même sémantique que {@link #mergeVariantAttributes} au
     * niveau Tome (audit UX "correction manuelle" : jusqu'ici, seul le Tome
     * avait une jaquette rattrapable après coup, jamais la Série). {@code
     * additionalAttributes} gagne sur les clés déjà présentes - utilisé
     * volontairement pour remplacer une jaquette absente/fausse par la bonne,
     * jamais l'inverse (un appelant ne doit fournir que des données fraîches
     * qu'il veut voir persistées, jamais une valeur vide pour "effacer" un
     * attribut existant).
     */
    public void mergeAttributes(Map<String, Object> additionalAttributes) {
        attributes.putAll(additionalAttributes);
    }

    /**
     * Ce que l'utilisateur TAPE (Lot 130) : ecrit comme {@link #mergeAttributes},
     * et marque chaque cle comme saisie a la main. Une source ne reviendra
     * plus dessus (voir {@link #recopierDepuisLaSource}). Une valeur saisie
     * identique a celle de la source est marquee quand meme : l'utilisateur a
     * tranche, ce n'est pas a la source de le contredire plus tard.
     */
    public void saisirAttributs(Map<String, Object> attributsSaisis) {
        attributes.putAll(attributsSaisis);
        champsSaisis.addAll(attributsSaisis.keySet());
    }

    /**
     * Ce qu'une SOURCE rend (rechargement, rattrapage) : n'ecrit que les cles
     * qui n'ont pas ete saisies a la main, et dit lesquelles. Regle de
     * l'utilisateur (2026-09-04) : « si on recharge depuis l'api alors on
     * ecrase les infos non deja editees ».
     */
    public Set<String> recopierDepuisLaSource(Map<String, Object> attributsDeLaSource) {
        Set<String> ecrites = new HashSet<>();
        for (Map.Entry<String, Object> entree : attributsDeLaSource.entrySet()) {
            if (champsSaisis.contains(entree.getKey())) {
                continue;
            }
            attributes.put(entree.getKey(), entree.getValue());
            ecrites.add(entree.getKey());
        }
        return ecrites;
    }

    /** Reprend des marques telles quelles - l'import d'un export (Lot 130). */
    public void marquerSaisis(java.util.Collection<String> cles) {
        champsSaisis.addAll(cles);
    }

    /**
     * Retire un attribut - opération À PART de {@link #mergeAttributes}, dont
     * la javadoc interdit justement la valeur vide comme moyen d'effacer.
     * Vider un champ dans un formulaire d'édition doit vraiment le faire
     * disparaître, pas laisser une chaîne vide qui ressemblerait ensuite à
     * une donnée renseignée. Sans effet si la clé n'existe pas : effacer ce
     * qui n'est pas là n'est pas une erreur.
     */
    public void removeAttribute(String key) {
        attributes.remove(key);
        // Vider un champ a la main, c'est aussi rendre la place a la source :
        // elle pourra le remplir au prochain rechargement (Lot 130).
        champsSaisis.remove(key);
    }

    public Variant addVariant(String label, Map<String, Object> variantAttributes) {
        Variant variant = new Variant(UUID.randomUUID(), label, variantAttributes, null);
        variants.add(variant);
        return variant;
    }

    /** Retrouve un Variant existant par son label (insensible à la casse) - utilisé
     * par QuickAddService pour éviter de recréer "Tome 3" en double si l'utilisateur
     * ajoute un deuxième exemplaire du même tome. */
    public Optional<Variant> findVariantByLabel(String label) {
        return variants.stream().filter(v -> v.label().equalsIgnoreCase(label)).findFirst();
    }

    /**
     * Complète les attributs d'un Variant déjà existant SANS écraser ceux déjà
     * renseignés (même logique de fusion que QuickAddService pour l'Entity) -
     * typiquement pour retrouver après coup la jaquette propre à un tome ajouté
     * en saisie manuelle (voir "Retrouver les jaquettes manquantes", Ma
     * collection) sans avoir à recréer le Variant. {@code additionalAttributes}
     * gagne sur les clés déjà présentes - utilisé volontairement pour remplacer
     * une jaquette introuvable (null) par une jaquette retrouvée, jamais l'inverse
     * (un appelant ne doit fournir que des données fraîches qu'il veut voir
     * persistées, jamais une valeur vide pour "effacer" un attribut existant).
     */
    public void mergeVariantAttributes(UUID variantId, Map<String, Object> additionalAttributes) {
        int index = -1;
        for (int i = 0; i < variants.size(); i++) {
            if (variants.get(i).id().equals(variantId)) {
                index = i;
                break;
            }
        }
        if (index < 0) {
            throw new IllegalArgumentException("Variant introuvable : " + variantId);
        }
        Variant existing = variants.get(index);
        Map<String, Object> merged = new HashMap<>(existing.attributes());
        merged.putAll(additionalAttributes);
        variants.set(index, new Variant(existing.id(), existing.label(), merged, existing.mangaEditionId()));
    }

    /**
     * Relie un Tome déjà existant à son Édition catalogue ({@link MangaEdition}) - modèle
     * cible Série -> Édition -> Tome. Même patron de recherche que
     * {@link #mergeVariantAttributes(UUID, Map)}. Ne retire jamais un lien existant (pas de
     * besoin identifié pour l'instant) - un appelant qui résout un lien plus précis peut
     * simplement rappeler cette méthode avec le nouvel id.
     */
    public void linkVariantToEdition(UUID variantId, UUID mangaEditionId) {
        int index = -1;
        for (int i = 0; i < variants.size(); i++) {
            if (variants.get(i).id().equals(variantId)) {
                index = i;
                break;
            }
        }
        if (index < 0) {
            throw new IllegalArgumentException("Variant introuvable : " + variantId);
        }
        Variant existing = variants.get(index);
        variants.set(index, new Variant(existing.id(), existing.label(), existing.attributes(), mangaEditionId));
    }

    /**
     * Retire un Tome du catalogue - action utilisateur explicite (voir "Supprimer ce
     * tome"), jamais automatique sur passage à zéro Ownership (modèle cible Série ->
     * Édition -> Tome : un Tome catalogué existe indépendamment de sa possession, voir
     * Variant). La garde contre les Ownership/Experience qui le référencent encore vit
     * en couche application (VariantDeletionService), pas ici - même raison que pour
     * {@link #mergeVariantAttributes} : Entity ne connaît pas les repositories des
     * autres agrégats.
     */
    public void removeVariant(UUID variantId) {
        boolean removed = variants.removeIf(v -> v.id().equals(variantId));
        if (!removed) {
            throw new IllegalArgumentException("Variant introuvable : " + variantId);
        }
    }

    public void addTag(UUID tagId) {
        tagIds.add(tagId);
    }

    public void removeTag(UUID tagId) {
        tagIds.remove(tagId);
    }

    public List<DomainEvent> pullDomainEvents() {
        List<DomainEvent> events = List.copyOf(pendingEvents);
        pendingEvents.clear();
        return events;
    }

    public UUID id() {
        return id;
    }

    public UUID entityTypeId() {
        return entityTypeId;
    }

    public String title() {
        return title;
    }

    public Map<String, Object> attributes() {
        return Map.copyOf(attributes);
    }

    public List<Variant> variants() {
        return List.copyOf(variants);
    }

    public Set<UUID> tagIds() {
        return Set.copyOf(tagIds);
    }

    /** Les cles saisies a la main, qu'un rechargement depuis la source ne touche pas (Lot 130). */
    public Set<String> champsSaisis() {
        return Set.copyOf(champsSaisis);
    }
}
