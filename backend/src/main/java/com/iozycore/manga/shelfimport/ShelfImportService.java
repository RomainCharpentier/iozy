package com.iozycore.manga.shelfimport;

import com.iozycore.core.application.QuickAddService;
import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.EntityType;
import com.iozycore.core.domain.catalog.EntityTypeRepository;
import com.iozycore.core.domain.catalog.Variant;
import com.iozycore.core.domain.ownership.Ownership;
import com.iozycore.core.domain.ownership.OwnershipCondition;
import com.iozycore.core.domain.ownership.OwnershipRepository;
import com.iozycore.core.domain.shared.TexteRecherche;
import com.iozycore.core.metadata.MetadataCandidate;
import com.iozycore.core.metadata.MetadataSearchService;
import com.iozycore.manga.recognition.CatalogStatus;
import com.iozycore.manga.recognition.ListingRecognitionService;
import com.iozycore.manga.recognition.RecognitionContext;
import com.iozycore.manga.recognition.RecognitionImage;
import com.iozycore.manga.recognition.ResolvedItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Import your library from photos of the shelf.
 *
 * <pre>
 * photos ──> ListingRecognitionService ──> proposals (series, volumes, editions)
 *                                                │
 *                          ┌─────────────────────┴─────────────────────┐
 *                          │ already owned? (variants + ownerships)    │
 *                          │ detail page proposed? (sources, if not in catalog) │
 *                          └─────────────────────┬─────────────────────┘
 *                                                ↓
 *                                   the review screen
 *                                                ↓ (user action)
 *                                       apply: quick add, volume by volume
 * </pre>
 *
 * <h2>The same engine as the listing analysis</h2>
 * Nothing is read twice: reading the photos, consolidation and
 * matching with the catalog are those of {@link ListingRecognitionService}.
 * This service only adds what sets a shelf apart from a listing: on a
 * listing, we ask what we would <b>buy</b>; on one's shelf, what
 * we <b>already have</b>. Hence the two questions asked here and not there.
 *
 * <h2>Already owned</h2>
 * A volume of the shelf that is already owned in iozycore must not become
 * a second copy: photographing the same row again must create nothing.
 * The rule is deliberately wide - the number is enough, whatever
 * the edition - because an edition reading on a spine is uncertain,
 * and a duplicate costs more than a volume to confirm by hand.
 *
 * <h2>A detail page proposed, never imposed</h2>
 * A series missing from the catalog is searched at the sources under the title
 * read; the first detail page whose title matches is <b>proposed</b>, with
 * its cover and its attributes, as the Catalog would do. The user
 * sees it before importing. No detail page is created here.
 *
 * <h2>What the analysis never writes</h2>
 * {@link #analyze} creates no Entity, no volume, no ownership. Only
 * {@link #apply}, on the list the user confirmed, writes - and it
 * reuses quick add, so the same deduplication (type + title for the
 * series, label for the volume) as the Catalog and the scan.
 */
@Service
public class ShelfImportService {

    private static final Logger log = LoggerFactory.getLogger(ShelfImportService.class);

    /**
     * How many unknown series are searched at the sources for one
     * analysis. A shelf rarely shows more; beyond that, the next ones
     * stay "without a detail page" and the count is shown on screen, instead of
     * burning the providers' quotas on a single photo.
     */
    static final int RECHERCHES_MAX = 20;

    /** Reading the photos - the listing engine, without listing text. */
    interface Lecture {
        ListingRecognitionService.Analysis lire(List<RecognitionImage> photos, int demandees);
    }

    /** What the service reads from the catalog and the collection. */
    interface Catalogue {
        Optional<EntityType> mangaType();

        Optional<Entity> entity(UUID id);

        Optional<Entity> entityByTitle(UUID entityTypeId, String title);

        List<Ownership> ownerships(UUID entityId);

        List<MetadataCandidate> chercher(EntityType type, String titre);
    }

    /** Adding a volume to the collection - quick add, under a short signature. */
    interface Ajout {
        QuickAddService.QuickAddResult ajouter(UUID entityTypeId, String title, Map<String, Object> attributes,
                                               int volumeNumber, String edition);
    }

    private final Lecture lecture;
    private final Catalogue catalogue;
    private final Ajout ajout;

    @Autowired
    public ShelfImportService(ListingRecognitionService recognition,
                              EntityTypeRepository entityTypeRepository,
                              EntityRepository entityRepository,
                              OwnershipRepository ownershipRepository,
                              MetadataSearchService metadataSearchService,
                              QuickAddService quickAddService) {
        this((photos, demandees) -> recognition.analyzeUploadedPhotos(
                        null, null, photos, RecognitionContext.forManga(), demandees),
                new Catalogue() {
                    @Override
                    public Optional<EntityType> mangaType() {
                        return entityTypeRepository.findByCode(RecognitionContext.MANGA);
                    }

                    @Override
                    public Optional<Entity> entity(UUID id) {
                        return entityRepository.findById(id);
                    }

                    @Override
                    public Optional<Entity> entityByTitle(UUID entityTypeId, String title) {
                        return entityRepository.findByTypeAndTitle(entityTypeId, title);
                    }

                    @Override
                    public List<Ownership> ownerships(UUID entityId) {
                        return ownershipRepository.findByEntityId(entityId);
                    }

                    @Override
                    public List<MetadataCandidate> chercher(EntityType type, String titre) {
                        return metadataSearchService.search(type, titre, true);
                    }
                },
                (typeId, title, attributes, volumeNumber, edition) -> quickAddService.addNewEntityWithOwnership(
                        typeId, title, OwnershipCondition.NEW, attributes, volumeNumber, edition, null, null, null));
    }

    ShelfImportService(Lecture lecture, Catalogue catalogue, Ajout ajout) {
        this.lecture = lecture;
        this.catalogue = catalogue;
        this.ajout = ajout;
    }

    // ================================================================ Reading

    /**
     * Reads the photos and returns what the review screen shows.
     *
     * @param photos    the images already validated by {@code UploadedImageReader}
     * @param demandees what the user sent, including what was dropped
     */
    @Transactional(readOnly = true)
    public ShelfAnalysis analyze(List<RecognitionImage> photos, int demandees) {
        ListingRecognitionService.Analysis analyse = lecture.lire(photos, demandees);
        Optional<EntityType> manga = catalogue.mangaType();

        Map<UUID, Set<Integer>> numerosPossedes = new HashMap<>();
        Map<String, Optional<Proposition>> fichesParTitre = new LinkedHashMap<>();
        int recherchesSautees = 0;

        List<ShelfItem> items = new ArrayList<>(analyse.items().size());
        for (ResolvedItem item : analyse.items()) {
            boolean possede = item.entityId() != null && item.recognized().volumeNumber() != null
                    && numerosPossedes.computeIfAbsent(item.entityId(), this::numerosPossedes)
                            .contains(item.recognized().volumeNumber());

            Proposition fiche = null;
            if (item.catalogStatus() == CatalogStatus.NOT_IN_CATALOG && manga.isPresent()) {
                String cle = TexteRecherche.normaliser(item.displayTitle());
                if (fichesParTitre.containsKey(cle)) {
                    fiche = fichesParTitre.get(cle).orElse(null);
                } else if (fichesParTitre.size() < RECHERCHES_MAX) {
                    Optional<Proposition> trouvee = proposerUneFiche(manga.get(), item.displayTitle());
                    fichesParTitre.put(cle, trouvee);
                    fiche = trouvee.orElse(null);
                } else {
                    recherchesSautees++;
                }
            }
            items.add(new ShelfItem(item, possede, fiche == null ? null : fiche.fiche(),
                    fiche != null && fiche.parLeTitre()));
        }

        return new ShelfAnalysis(analyse.visionStatus(), items, analyse.unidentifiedCount(),
                analyse.analyzedImageCount(), analyse.requestedImageCount(), recherchesSautees);
    }

    /**
     * The volume numbers of which at least one copy is still owned.
     *
     * <p>A variant is not an ownership: a volume may have been wanted,
     * sold or lost. Only an <b>active</b> ownership counts, and the number
     * is read from the variant it references.
     */
    private Set<Integer> numerosPossedes(UUID entityId) {
        Optional<Entity> entity = catalogue.entity(entityId);
        if (entity.isEmpty()) {
            return Set.of();
        }
        Map<UUID, Integer> numeroParVariante = new HashMap<>();
        for (Variant variante : entity.get().variants()) {
            Integer numero = numeroDe(variante);
            if (numero != null) {
                numeroParVariante.put(variante.id(), numero);
            }
        }
        return catalogue.ownerships(entityId).stream()
                .filter(Ownership::isActive)
                .map(possession -> possession.variantId().map(numeroParVariante::get).orElse(null))
                .filter(numero -> numero != null)
                .collect(Collectors.toSet());
    }

    /** The number of a volume, as TomeResolver writes it in the variant attributes. */
    static Integer numeroDe(Variant variante) {
        Object brut = variante.attributes().get("volumeNumber");
        if (brut instanceof Number nombre) {
            return nombre.intValue();
        }
        if (brut instanceof String texte) {
            try {
                return Integer.parseInt(texte.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    /**
     * The detail page that the Catalog would propose for this title.
     *
     * <p>The exact title first; failing that, a detail page whose title contains
     * every word read - "Naruto" read on a spine must not become
     * "Boruto : Naruto Next Generations" when "Naruto" exists, but
     * "Attaque des Titans" can find "L'Attaque des Titans". Nothing
     * looser: a wrong detail page proposed with confidence costs more than a
     * series created with its title only.
     */
    /**
     * @param fiche      the proposed detail page
     * @param parLeTitre true when its title matches what was read; false
     *                   when it is only the first result of the search
     */
    record Proposition(MetadataCandidate fiche, boolean parLeTitre) {
    }

    /** Below this, a title read is too vague for a first search result to be worth anything. */
    static final int MOTS_MIN_POUR_LE_PREMIER_RESULTAT = 2;

    private Optional<Proposition> proposerUneFiche(EntityType manga, String titreLu) {
        List<MetadataCandidate> candidats;
        try {
            candidats = catalogue.chercher(manga, titreLu);
        } catch (RuntimeException e) {
            // A source that stays silent does not prevent the import: the series will be
            // created with the title read, and "Recharger depuis la source" will do
            // the rest later.
            log.warn("Detail page search impossible for \"{}\": {}", titreLu, e.getClass().getSimpleName());
            return Optional.empty();
        }
        if (candidats == null || candidats.isEmpty()) {
            return Optional.empty();
        }
        String lu = TexteRecherche.normaliser(titreLu);
        Optional<MetadataCandidate> exacte = candidats.stream()
                .filter(c -> c.title() != null && TexteRecherche.normaliser(c.title()).equals(lu))
                .findFirst();
        if (exacte.isPresent()) {
            return exacte.map(c -> new Proposition(c, true));
        }
        Optional<MetadataCandidate> contient = candidats.stream()
                .filter(c -> c.title() != null
                        && TexteRecherche.contientChaqueMot(TexteRecherche.normaliser(c.title()), lu))
                .findFirst();
        if (contient.isPresent()) {
            return contient.map(c -> new Proposition(c, true));
        }
        // The French title of a shelf ("L'Attaque des Titans") does not look like
        // the romaji or English title of the detail page ("Shingeki no Kyojin");
        // the search, however, finds it through its synonyms. The first result
        // is then PROPOSED but not believed: the screen shows it as a lead, and
        // keeps it only if the user says so. Never on a single word: too
        // vague for a first result to designate anything.
        long mots = java.util.Arrays.stream(lu.split(" ")).filter(mot -> !mot.isBlank()).count();
        if (mots >= MOTS_MIN_POUR_LE_PREMIER_RESULTAT) {
            return Optional.of(new Proposition(candidats.get(0), false));
        }
        return Optional.empty();
    }

    // ================================================================ Writing

    /**
     * Adds the confirmed volumes, in a single transaction.
     *
     * <p>Each volume goes through quick add: the series is found or
     * created (type + title), the volume found or created (label), the ownership
     * added. A volume of which a copy is still owned is not added
     * a second time - same rule as at analysis, checked again here because the
     * collection may have changed between the two.
     */
    @Transactional
    public ShelfImportReport apply(List<ItemToImport> items) {
        EntityType manga = catalogue.mangaType()
                .orElseThrow(() -> new IllegalStateException("Le type MANGA n'existe pas sur cette instance"));

        List<ShelfImportReport.ImportedItem> resultats = new ArrayList<>(items.size());
        for (ItemToImport item : items) {
            String titre = item.seriesTitle().trim();
            Optional<Entity> existante = catalogue.entityByTitle(manga.id(), titre);
            boolean possede = existante.isPresent()
                    && numerosPossedes(existante.get().id()).contains(item.volumeNumber());
            if (possede) {
                resultats.add(new ShelfImportReport.ImportedItem(titre, item.volumeNumber(), item.editionOrNull(),
                        ShelfImportReport.Outcome.ALREADY_OWNED, false, existante.get().id()));
                continue;
            }

            QuickAddService.QuickAddResult resultat = ajout.ajouter(manga.id(), titre, item.attributesForEntity(),
                    item.volumeNumber(), item.editionOrNull());
            resultats.add(new ShelfImportReport.ImportedItem(titre, item.volumeNumber(), item.editionOrNull(),
                    ShelfImportReport.Outcome.ADDED, !resultat.matchedExistingEntity(), resultat.entityId()));
        }
        return new ShelfImportReport(resultats);
    }
}
