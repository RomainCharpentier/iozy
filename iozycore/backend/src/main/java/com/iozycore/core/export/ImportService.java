package com.iozycore.core.export;

import com.iozycore.core.domain.follow.FollowedWork;
import com.iozycore.core.domain.follow.FollowedWorkRepository;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.catalog.Relationship;
import com.iozycore.core.domain.catalog.RelationshipRepository;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.experience.Experience;
import com.iozycore.core.domain.experience.ExperienceRepository;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.ownership.OwnershipStatus;
import com.iozycore.core.domain.tierlist.EntityRank;
import com.iozycore.core.domain.tierlist.EntityRankRepository;
import com.iozycore.core.domain.tierlist.Rank;
import com.iozycore.core.domain.tierlist.TierList;
import com.iozycore.core.domain.tierlist.TierListItem;
import com.iozycore.core.domain.tierlist.TierListItemRepository;
import com.iozycore.core.domain.tierlist.TierListRepository;
import com.iozycore.core.domain.wishlist.WishlistEntry;
import com.iozycore.core.domain.wishlist.WishlistEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The return trip of the export: the same document, the other way round.
 *
 * <h2>Why now, and why this format</h2>
 * §19 of docs/CONCEPTION.md describes the target flow of an import (source ->
 * analysis -> matching -> ambiguous cases -> validation) and asks not to
 * build it before a concrete source justifies it. The export of the
 * application is this source: without it, "Take my collection" was a
 * one-way trip, and neither changing NAS nor starting again from a backup was
 * possible other than by restoring the whole PostgreSQL.
 *
 * <h2>Two passes, one single code</h2>
 * {@link #analyser} and {@link #appliquer} go through the document in the same
 * way; only the first one abstains from writing. The report of the analysis is
 * therefore exactly what the application will do - it is the validation screen of
 * §19, without two implementations being able to diverge.
 *
 * <h2>The matching rules</h2>
 * The catalog (types, tags, works, volumes, editions, relationships) is
 * SHARED between accounts: we attach to it by its natural key - type
 * code, tag label, work (type, title), volume label, (series,
 * edition) - exactly as quick add and the BGG import already do.
 * What is PRIVATE (ownerships, experiences, wishes, rankings, followed editions,
 * recorded prices, preferences) is recreated for the account that imports,
 * skipping what already exists identically. Nothing existing is ever
 * changed or deleted: an import adds, or abstains and says so.
 *
 * <p>The ids of the file are never reused: the same
 * backup can therefore be imported on the instance that produced it without
 * collision, and the matching by natural key means it creates
 * nothing there.
 */
@Service
@RequiredArgsConstructor
public class ImportService {

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final TagRepository tagRepository;
    private final RelationshipRepository relationshipRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final FollowedWorkRepository followedWorkRepository;
    private final EntityRankRepository entityRankRepository;
    private final TierListRepository tierListRepository;
    private final TierListItemRepository tierListItemRepository;
    /** What each universe imports in addition - manga, its editions and its prices (Batch 133). */
    private final List<TransferModule> modules;

    /** Tells what the import would do, without writing anything. */
    @Transactional(readOnly = true)
    public ImportReport analyser(ExportDocument document, boolean peutCreerDesTags) {
        return new Passe(document, false, peutCreerDesTags).executer();
    }

    /**
     * Writes, in one single transaction: a file that fails halfway does not
     * leave half a collection behind it.
     */
    @Transactional
    public ImportReport appliquer(ExportDocument document, boolean peutCreerDesTags) {
        return new Passe(document, true, peutCreerDesTags).executer();
    }

    /** One pass over the document, with the correspondence tables old id -> new object. */
    private final class Passe {
        private final ExportDocument doc;
        private final boolean ecrire;
        private final boolean peutCreerDesTags;
        private final ImportReport.Cumul cumul = new ImportReport.Cumul();

        private final Map<String, UUID> typeParCode = new HashMap<>();
        private final Map<String, UUID> typeParLibelle = new HashMap<>();
        private final Map<String, UUID> tagParLibelle = new HashMap<>();
        /** Old work id -> the work (existing or created), to link its volumes to the editions afterwards. */
        private final Map<UUID, Entity> oeuvres = new LinkedHashMap<>();
        private final Map<UUID, UUID> tomes = new HashMap<>();
        private final Map<UUID, UUID> editions = new HashMap<>();
        private final Set<UUID> oeuvresACreer = new HashSet<>();

        Passe(ExportDocument doc, boolean ecrire, boolean peutCreerDesTags) {
            this.doc = doc;
            this.ecrire = ecrire;
            this.peutCreerDesTags = peutCreerDesTags;
        }

        ImportReport executer() {
            types();
            tags();
            oeuvres();
            for (TransferModule module : modules) {
                module.importerReferences(contexte());
            }
            liensTomesEditions();
            possessions();
            experiences();
            envies();
            oeuvresSuivies();
            relations();
            classementsGeneraux();
            tierLists();
            for (TransferModule module : modules) {
                module.importerComplements(contexte());
            }
            return cumul.rapport(ecrire);
        }

        // ----- shared catalog ---------------------------------------------------------

        private void types() {
            cumul.section("entityTypes", "Categories de collection");
            for (EntityType existant : entityTypeRepository.findAll()) {
                typeParCode.put(existant.code(), existant.id());
                typeParLibelle.put(existant.label(), existant.id());
            }
            for (ExportDocument.EntityTypeExport t : liste(doc.entityTypes())) {
                if (t.code() == null || t.code().isBlank()) {
                    cumul.ignore("entityTypes", nonVide(t.label(), "?"), "sans code");
                    continue;
                }
                if (typeParCode.containsKey(t.code())) {
                    cumul.rattache("entityTypes", t.code(), "categorie deja declaree");
                    continue;
                }
                EntityType cree = EntityType.create(t.code(), t.label(), new HashSet<>(liste(t.allowedExperienceTypes())),
                        new HashSet<>(liste(t.customFieldKeys())), t.colorKey(), t.iconKey(), t.aspectKey());
                if (ecrire) {
                    cree = entityTypeRepository.save(cree);
                }
                typeParCode.put(cree.code(), cree.id());
                typeParLibelle.put(cree.label(), cree.id());
                cumul.cree("entityTypes");
            }
        }

        private void tags() {
            cumul.section("tags", "Tags");
            for (Tag existant : tagRepository.findAll()) {
                tagParLibelle.put(existant.label(), existant.id());
            }
            // The labels carried by the works count too: an old export
            // did not have a separate `tags` list.
            Set<String> libelles = new HashSet<>();
            for (ExportDocument.TagExport t : liste(doc.tags())) {
                libelles.add(t.label());
            }
            for (ExportDocument.EntityExport e : liste(doc.entities())) {
                libelles.addAll(liste(e.tagLabels()));
            }
            for (String libelle : libelles) {
                if (libelle == null || libelle.isBlank()) {
                    continue;
                }
                if (tagParLibelle.containsKey(libelle)) {
                    cumul.rattache("tags", libelle, "tag deja present");
                    continue;
                }
                if (!peutCreerDesTags) {
                    // Same rule as the API: only an administrator puts a tag
                    // in the shared catalog (see SecurityConfig).
                    cumul.ignore("tags", libelle, "seul un administrateur peut creer un tag - les oeuvres seront importees sans");
                    continue;
                }
                Tag cree = new Tag(UUID.randomUUID(), libelle);
                if (ecrire) {
                    cree = tagRepository.save(cree);
                }
                tagParLibelle.put(libelle, cree.id());
                cumul.cree("tags");
            }
        }

        private void oeuvres() {
            cumul.section("entities", "Oeuvres et tomes");
            for (ExportDocument.EntityExport e : liste(doc.entities())) {
                String titre = nonVide(e.title(), "(sans titre)");
                UUID typeId = e.entityTypeCode() == null ? null : typeParCode.get(e.entityTypeCode());
                if (typeId == null) {
                    cumul.ignore("entities", titre, "categorie « " + e.entityTypeCode() + " » inconnue");
                    continue;
                }
                if (e.title() == null || e.title().isBlank()) {
                    cumul.ignore("entities", titre, "titre vide");
                    continue;
                }
                Optional<Entity> existante = entityRepository.findByTypeAndTitle(typeId, e.title());
                Entity oeuvre;
                boolean modifiee = false;
                if (existante.isPresent()) {
                    oeuvre = existante.get();
                    int tomesAjoutes = 0;
                    for (ExportDocument.VariantExport v : liste(e.variants())) {
                        if (v.label() == null || v.label().isBlank()) {
                            continue;
                        }
                        Optional<Variant> tome = oeuvre.findVariantByLabel(v.label());
                        if (tome.isPresent()) {
                            tomes.put(v.id(), tome.get().id());
                        } else {
                            tomes.put(v.id(), oeuvre.addVariant(v.label(), v.attributes()).id());
                            tomesAjoutes++;
                            modifiee = true;
                        }
                    }
                    for (UUID tagId : tagsDe(e)) {
                        if (!oeuvre.tagIds().contains(tagId)) {
                            oeuvre.addTag(tagId);
                            modifiee = true;
                        }
                    }
                    cumul.rattache("entities", titre, tomesAjoutes == 0
                            ? "oeuvre deja au catalogue, rien a ajouter"
                            : "oeuvre deja au catalogue, " + tomesAjoutes + (tomesAjoutes > 1 ? " tomes ajoutes" : " tome ajoute"));
                } else {
                    oeuvre = Entity.create(typeId, e.title());
                    if (e.attributes() != null) {
                        oeuvre.mergeAttributes(e.attributes());
                    }
                    oeuvre.marquerSaisis(liste(e.champsSaisis()));
                    for (ExportDocument.VariantExport v : liste(e.variants())) {
                        if (v.label() == null || v.label().isBlank()) {
                            continue;
                        }
                        tomes.put(v.id(), oeuvre.addVariant(v.label(), v.attributes()).id());
                    }
                    tagsDe(e).forEach(oeuvre::addTag);
                    oeuvresACreer.add(e.id());
                    modifiee = true;
                    cumul.cree("entities");
                }
                if (ecrire && modifiee) {
                    oeuvre = entityRepository.save(oeuvre);
                }
                oeuvres.put(e.id(), oeuvre);
            }
        }

        private List<UUID> tagsDe(ExportDocument.EntityExport e) {
            return liste(e.tagLabels()).stream().map(tagParLibelle::get).filter(Objects::nonNull).toList();
        }

        /**
         * The volume -> edition link can only be set once both are created:
         * third pass over the works, which only touches volumes still
         * without an edition.
         */
        private void liensTomesEditions() {
            for (ExportDocument.EntityExport e : liste(doc.entities())) {
                Entity oeuvre = oeuvres.get(e.id());
                if (oeuvre == null) {
                    continue;
                }
                boolean modifiee = false;
                for (ExportDocument.VariantExport v : liste(e.variants())) {
                    UUID editionId = v.mangaEditionId() == null ? null : editions.get(v.mangaEditionId());
                    UUID tomeId = tomes.get(v.id());
                    if (editionId == null || tomeId == null) {
                        continue;
                    }
                    boolean dejaLie = oeuvre.variants().stream()
                            .anyMatch(t -> t.id().equals(tomeId) && t.mangaEditionId() != null);
                    if (!dejaLie) {
                        oeuvre.linkVariantToEdition(tomeId, editionId);
                        modifiee = true;
                    }
                }
                if (ecrire && modifiee) {
                    oeuvres.put(e.id(), entityRepository.save(oeuvre));
                }
            }
        }

        private void oeuvresSuivies() {
            cumul.section("followedWorks", "Œuvres suivies");
            for (ExportDocument.FollowedWorkExport f : liste(doc.followedWorks())) {
                String sujet = nonVide(f.entityTitle(), "?");
                UUID entityId = oeuvreId(f.entityId());
                if (entityId == null) {
                    cumul.ignore("followedWorks", sujet, "oeuvre non importee");
                    continue;
                }
                if (!oeuvresACreer.contains(f.entityId()) && followedWorkRepository.findByEntityId(entityId).isPresent()) {
                    cumul.rattache("followedWorks", sujet, "deja suivie");
                    continue;
                }
                if (ecrire) {
                    followedWorkRepository.save(FollowedWork.follow(entityId, f.followedAt()));
                }
                cumul.cree("followedWorks");
            }
        }

        private void relations() {
            cumul.section("relationships", "Relations");
            for (ExportDocument.RelationshipExport r : liste(doc.relationships())) {
                String sujet = nonVide(r.sourceEntityTitle(), "?") + " → " + nonVide(r.targetEntityTitle(), "?");
                UUID source = oeuvreId(r.sourceEntityId());
                UUID cible = oeuvreId(r.targetEntityId());
                if (source == null || cible == null) {
                    cumul.ignore("relationships", sujet, "une des deux oeuvres n'a pas ete importee");
                    continue;
                }
                boolean existe = relationshipRepository.findBySourceEntityId(source).stream()
                        .anyMatch(x -> x.targetEntityId().equals(cible)
                                && Objects.equals(x.relationshipType(), r.relationshipType()));
                if (existe) {
                    cumul.rattache("relationships", sujet, "relation deja presente");
                    continue;
                }
                try {
                    Relationship creee = new Relationship(UUID.randomUUID(), source, cible, r.relationshipType());
                    if (ecrire) {
                        relationshipRepository.save(creee);
                    }
                    cumul.cree("relationships");
                } catch (IllegalArgumentException ex) {
                    cumul.ignore("relationships", sujet, ex.getMessage());
                }
            }
        }

        // ----- private collection --------------------------------------------------------

        private void possessions() {
            cumul.section("ownerships", "Possessions");
            Map<UUID, List<Ownership>> existantesParOeuvre = new HashMap<>();
            for (ExportDocument.OwnershipExport o : liste(doc.ownerships())) {
                String sujet = nonVide(o.entityTitle(), "?") + (o.variantLabel() == null ? "" : " · " + o.variantLabel());
                UUID entityId = oeuvreId(o.entityId());
                if (entityId == null) {
                    cumul.ignore("ownerships", sujet, "oeuvre non importee");
                    continue;
                }
                UUID variantId = o.variantId() == null ? null : tomes.get(o.variantId());
                if (o.variantId() != null && variantId == null) {
                    cumul.ignore("ownerships", sujet, "tome non retrouve");
                    continue;
                }
                OwnershipCondition condition = enumOuNull(OwnershipCondition.class, o.condition());
                OwnershipStatus statut = enumOuNull(OwnershipStatus.class, o.status());
                if (condition == null || statut == null) {
                    cumul.ignore("ownerships", sujet, "etat ou statut inconnu");
                    continue;
                }
                List<Ownership> existantes = existantesParOeuvre.computeIfAbsent(entityId,
                        id -> oeuvresACreer.contains(o.entityId()) ? List.of() : ownershipRepository.findByEntityId(id));
                boolean doublon = existantes.stream().anyMatch(x -> Objects.equals(x.variantId().orElse(null), variantId)
                        && x.status() == statut && x.condition() == condition
                        && Objects.equals(x.acquiredAt(), o.acquiredAt()));
                if (doublon) {
                    cumul.rattache("ownerships", sujet, "exemplaire identique deja present");
                    continue;
                }
                Ownership creee = Ownership.acquire(entityId, variantId, condition, o.acquiredAt(), o.note());
                creee.updatePurchasePrice(o.purchasePrice());
                if (statut == OwnershipStatus.SOLD) {
                    creee.markSold();
                } else if (statut == OwnershipStatus.LOST) {
                    creee.markLost();
                }
                if (ecrire) {
                    ownershipRepository.save(creee);
                }
                cumul.cree("ownerships");
            }
        }

        private void experiences() {
            cumul.section("experiences", "Experiences");
            Map<UUID, List<Experience>> existantesParOeuvre = new HashMap<>();
            for (ExportDocument.ExperienceExport x : liste(doc.experiences())) {
                String sujet = nonVide(x.entityTitle(), "?") + " · " + nonVide(x.experienceType(), "?")
                        + (x.occurredAt() == null ? "" : " · " + x.occurredAt());
                UUID entityId = oeuvreId(x.entityId());
                if (entityId == null) {
                    cumul.ignore("experiences", sujet, "oeuvre non importee");
                    continue;
                }
                UUID variantId = x.variantId() == null ? null : tomes.get(x.variantId());
                List<Experience> existantes = existantesParOeuvre.computeIfAbsent(entityId,
                        id -> oeuvresACreer.contains(x.entityId()) ? List.of() : experienceRepository.findByEntityId(id));
                boolean doublon = existantes.stream().anyMatch(e -> Objects.equals(e.variantId().orElse(null), variantId)
                        && Objects.equals(e.experienceType(), x.experienceType())
                        && Objects.equals(e.occurredAt(), x.occurredAt())
                        && Objects.equals(e.rating().orElse(null), x.rating())
                        && Objects.equals(e.comment(), x.comment()));
                if (doublon) {
                    cumul.rattache("experiences", sujet, "experience identique deja enregistree");
                    continue;
                }
                try {
                    Experience creee = Experience.record_(entityId, variantId, x.experienceType(), x.occurredAt(),
                            x.rating(), x.comment());
                    if (ecrire) {
                        experienceRepository.save(creee);
                    }
                    cumul.cree("experiences");
                } catch (IllegalArgumentException ex) {
                    cumul.ignore("experiences", sujet, ex.getMessage());
                }
            }
        }

        private void envies() {
            cumul.section("wishlist", "Envies");
            for (ExportDocument.WishlistEntryExport w : liste(doc.wishlist())) {
                String sujet = nonVide(w.entityTitle(), "?") + (w.variantLabel() == null ? "" : " · " + w.variantLabel());
                UUID entityId = oeuvreId(w.entityId());
                if (entityId == null) {
                    cumul.ignore("wishlist", sujet, "oeuvre non importee");
                    continue;
                }
                UUID variantId = w.variantId() == null ? null : tomes.get(w.variantId());
                if (w.variantId() != null && variantId == null) {
                    cumul.ignore("wishlist", sujet, "tome non retrouve");
                    continue;
                }
                boolean existe = !oeuvresACreer.contains(w.entityId())
                        && wishlistEntryRepository.findAllByEntityId(entityId).stream()
                        .anyMatch(e -> Objects.equals(e.variantId().orElse(null), variantId));
                if (existe) {
                    cumul.rattache("wishlist", sujet, "envie deja notee");
                    continue;
                }
                LocalDate date = w.addedAt() == null ? LocalDate.now() : w.addedAt();
                WishlistEntry creee = variantId == null ? WishlistEntry.add(entityId, date)
                        : WishlistEntry.addVariant(entityId, variantId, date);
                if (ecrire) {
                    wishlistEntryRepository.save(creee);
                }
                cumul.cree("wishlist");
            }
        }

        private void classementsGeneraux() {
            cumul.section("generalRankings", "Classements generaux");
            for (ExportDocument.GeneralRankExport r : liste(doc.generalRankings())) {
                String sujet = nonVide(r.entityTitle(), "?");
                UUID entityId = oeuvreId(r.entityId());
                Rank rang = enumOuNull(Rank.class, r.rank());
                if (entityId == null || rang == null) {
                    cumul.ignore("generalRankings", sujet, entityId == null ? "oeuvre non importee" : "rang inconnu");
                    continue;
                }
                if (!oeuvresACreer.contains(r.entityId()) && entityRankRepository.findByEntityId(entityId).isPresent()) {
                    cumul.rattache("generalRankings", sujet, "deja classee - le classement actuel est conserve");
                    continue;
                }
                if (ecrire) {
                    entityRankRepository.save(EntityRank.assign(entityId, rang));
                }
                cumul.cree("generalRankings");
            }
        }

        private void tierLists() {
            cumul.section("tierLists", "Tier Lists");
            for (ExportDocument.TierListExport t : liste(doc.tierLists())) {
                String sujet = nonVide(t.name(), "?");
                if (t.name() == null || t.name().isBlank()) {
                    cumul.ignore("tierLists", sujet, "sans nom");
                    continue;
                }
                UUID typeId = t.entityTypeLabel() == null ? null : typeParLibelle.get(t.entityTypeLabel());
                if (t.entityTypeLabel() != null && typeId == null) {
                    cumul.ignore("tierLists", sujet, "categorie « " + t.entityTypeLabel() + " » inconnue");
                    continue;
                }
                List<TierList> candidates = typeId == null ? tierListRepository.findAllUniversesLists()
                        : tierListRepository.findByEntityTypeId(typeId);
                Optional<TierList> existante = candidates.stream()
                        .filter(l -> l.name().equalsIgnoreCase(t.name().trim())).findFirst();
                TierList tierList;
                if (existante.isPresent()) {
                    tierList = existante.get();
                } else {
                    Set<Rank> rangs = EnumSet.noneOf(Rank.class);
                    for (String r : liste(t.activeRanks())) {
                        Rank rang = enumOuNull(Rank.class, r);
                        if (rang != null) {
                            rangs.add(rang);
                        }
                    }
                    tierList = TierList.create(t.name(), typeId, rangs, t.description());
                    if (ecrire) {
                        tierList = tierListRepository.save(tierList);
                    }
                }
                int ajoutes = 0;
                int ignores = 0;
                for (ExportDocument.TierListItemExport item : liste(t.items())) {
                    UUID entityId = oeuvreId(item.entityId());
                    if (entityId == null) {
                        ignores++;
                        continue;
                    }
                    if (existante.isPresent()
                            && tierListItemRepository.findByTierListIdAndEntityId(tierList.id(), entityId).isPresent()) {
                        continue;
                    }
                    TierListItem cree = TierListItem.add(tierList.id(), entityId);
                    Rank rang = enumOuNull(Rank.class, item.rank());
                    if (rang != null) {
                        cree.setRank(rang);
                    }
                    if (ecrire) {
                        tierListItemRepository.save(cree);
                    }
                    ajoutes++;
                }
                String detail = ajoutes + " oeuvre(s) ajoutee(s)" + (ignores == 0 ? "" : ", " + ignores + " non importee(s)");
                if (existante.isPresent()) {
                    cumul.rattache("tierLists", sujet, "liste deja presente, " + detail);
                } else {
                    cumul.cree("tierLists");
                }
            }
        }

        // ----- tools --------------------------------------------------------------------

        /** What the universes see of this import (see TransferModule). */
        private ImportContexte contexte() {
            return new ImportContexte(doc, ecrire, cumul, oeuvres, tomes, editions, oeuvresACreer);
        }

        private UUID oeuvreId(UUID ancienId) {
            if (ancienId == null) {
                return null;
            }
            Entity oeuvre = oeuvres.get(ancienId);
            return oeuvre == null ? null : oeuvre.id();
        }
    }

    private static <T> List<T> liste(List<T> l) {
        return l == null ? List.of() : l;
    }

    private static String nonVide(String s, String sinon) {
        return s == null || s.isBlank() ? sinon : s;
    }

    private static <E extends Enum<E>> E enumOuNull(Class<E> type, String nom) {
        if (nom == null || nom.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, nom.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
