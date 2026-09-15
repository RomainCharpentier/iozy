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
 * Importer sa bibliothèque à partir de photos de l'étagère.
 *
 * <pre>
 * photos ──> ListingRecognitionService ──> propositions (séries, tomes, éditions)
 *                                                │
 *                          ┌─────────────────────┴─────────────────────┐
 *                          │ déjà possédé ? (variantes + possessions)  │
 *                          │ fiche proposée ? (sources, si hors catalogue) │
 *                          └─────────────────────┬─────────────────────┘
 *                                                ↓
 *                                   l'écran de vérification
 *                                                ↓ (geste de l'utilisateur)
 *                                       apply : ajout rapide, tome par tome
 * </pre>
 *
 * <h2>Le même moteur que l'analyse d'annonce</h2>
 * Rien n'est lu deux fois : la lecture des photos, la consolidation et la
 * confrontation au catalogue sont celles de {@link ListingRecognitionService}.
 * Ce service n'ajoute que ce qui distingue une étagère d'une annonce : sur une
 * annonce, on se demande ce qu'on <b>achèterait</b> ; sur son étagère, ce
 * qu'on <b>a déjà</b>. D'où les deux questions posées ici et pas là-bas.
 *
 * <h2>Déjà possédé</h2>
 * Un tome de son étagère qu'on possède déjà dans iozycore ne doit pas devenir
 * un second exemplaire : rephotographier la même rangée ne doit rien créer.
 * La règle est volontairement large - le numéro suffit, quelle que soit
 * l'édition - parce qu'une lecture d'édition sur une tranche est incertaine,
 * et qu'un doublon coûte plus qu'un tome à confirmer à la main.
 *
 * <h2>Une fiche proposée, jamais imposée</h2>
 * Une série absente du catalogue est cherchée chez les sources sous le titre
 * lu ; la première fiche dont le titre correspond est <b>proposée</b>, avec
 * sa jaquette et ses attributs, comme le ferait le Catalogue. L'utilisateur
 * la voit avant d'importer. Aucune fiche n'est créée ici.
 *
 * <h2>Ce que l'analyse n'écrit jamais</h2>
 * {@link #analyze} ne crée ni Entity, ni tome, ni possession. Seul
 * {@link #apply}, sur la liste que l'utilisateur a confirmée, écrit - et il
 * réutilise l'ajout rapide, donc la même déduplication (type + titre pour la
 * série, libellé pour le tome) que le Catalogue et le scan.
 */
@Service
public class ShelfImportService {

    private static final Logger log = LoggerFactory.getLogger(ShelfImportService.class);

    /**
     * Combien de séries inconnues sont cherchées chez les sources pour une
     * analyse. Une étagère en montre rarement plus ; au-delà, les suivantes
     * restent « sans fiche » et le compte est rendu à l'écran, plutôt que de
     * brûler les quotas des fournisseurs sur une seule photo.
     */
    static final int RECHERCHES_MAX = 20;

    /** La lecture des photos - le moteur d'annonce, sans texte d'annonce. */
    interface Lecture {
        ListingRecognitionService.Analysis lire(List<RecognitionImage> photos, int demandees);
    }

    /** Ce que le service lit du catalogue et de la collection. */
    interface Catalogue {
        Optional<EntityType> mangaType();

        Optional<Entity> entity(UUID id);

        Optional<Entity> entityByTitle(UUID entityTypeId, String title);

        List<Ownership> ownerships(UUID entityId);

        List<MetadataCandidate> chercher(EntityType type, String titre);
    }

    /** L'ajout d'un tome à la collection - l'ajout rapide, sous une signature courte. */
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

    // ================================================================ Lecture

    /**
     * Lit les photos et rend ce que l'écran de vérification affiche.
     *
     * @param photos    les images déjà validées par {@code UploadedImageReader}
     * @param demandees ce que l'utilisateur a envoyé, y compris ce qui a été écarté
     */
    @Transactional(readOnly = true)
    public ShelfAnalysis analyze(List<RecognitionImage> photos, int demandees) {
        ListingRecognitionService.Analysis analyse = lecture.lire(photos, demandees);
        Optional<EntityType> manga = catalogue.mangaType();

        Map<UUID, Set<Integer>> numerosPossedes = new HashMap<>();
        Map<String, Optional<MetadataCandidate>> fichesParTitre = new LinkedHashMap<>();
        int recherchesSautees = 0;

        List<ShelfItem> items = new ArrayList<>(analyse.items().size());
        for (ResolvedItem item : analyse.items()) {
            boolean possede = item.entityId() != null && item.recognized().volumeNumber() != null
                    && numerosPossedes.computeIfAbsent(item.entityId(), this::numerosPossedes)
                            .contains(item.recognized().volumeNumber());

            MetadataCandidate fiche = null;
            if (item.catalogStatus() == CatalogStatus.NOT_IN_CATALOG && manga.isPresent()) {
                String cle = TexteRecherche.normaliser(item.displayTitle());
                if (fichesParTitre.containsKey(cle)) {
                    fiche = fichesParTitre.get(cle).orElse(null);
                } else if (fichesParTitre.size() < RECHERCHES_MAX) {
                    Optional<MetadataCandidate> trouvee = proposerUneFiche(manga.get(), item.displayTitle());
                    fichesParTitre.put(cle, trouvee);
                    fiche = trouvee.orElse(null);
                } else {
                    recherchesSautees++;
                }
            }
            items.add(new ShelfItem(item, possede, fiche));
        }

        return new ShelfAnalysis(analyse.visionStatus(), items, analyse.unidentifiedCount(),
                analyse.analyzedImageCount(), analyse.requestedImageCount(), recherchesSautees);
    }

    /**
     * Les numéros de tome dont au moins un exemplaire est encore possédé.
     *
     * <p>Une variante n'est pas une possession : un tome peut avoir été voulu,
     * vendu ou perdu. Seule une possession <b>active</b> compte, et le numéro
     * est lu sur la variante qu'elle référence.
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

    /** Le numéro d'un tome, tel que TomeResolver l'écrit dans les attributs de la variante. */
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
     * La fiche que le Catalogue proposerait pour ce titre.
     *
     * <p>Le titre exact d'abord ; à défaut, une fiche dont le titre contient
     * chaque mot lu - « Naruto » lu sur une tranche ne doit pas devenir
     * « Boruto : Naruto Next Generations » alors que « Naruto » existe, mais
     * « Attaque des Titans » peut retrouver « L'Attaque des Titans ». Rien de
     * plus lâche : une fiche fausse proposée avec assurance coûte plus qu'une
     * série créée avec son seul titre.
     */
    private Optional<MetadataCandidate> proposerUneFiche(EntityType manga, String titreLu) {
        List<MetadataCandidate> candidats;
        try {
            candidats = catalogue.chercher(manga, titreLu);
        } catch (RuntimeException e) {
            // Une source qui se tait n'empêche pas d'importer : la série sera
            // créée avec le titre lu, et « Recharger depuis la source » fera
            // le reste plus tard.
            log.warn("Recherche de fiche impossible pour « {} » : {}", titreLu, e.getClass().getSimpleName());
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
            return exacte;
        }
        return candidats.stream()
                .filter(c -> c.title() != null
                        && TexteRecherche.contientChaqueMot(TexteRecherche.normaliser(c.title()), lu))
                .findFirst();
    }

    // ================================================================ Écriture

    /**
     * Ajoute les tomes confirmés, dans une seule transaction.
     *
     * <p>Chaque tome passe par l'ajout rapide : la série est retrouvée ou
     * créée (type + titre), le tome retrouvé ou créé (libellé), la possession
     * ajoutée. Un tome dont un exemplaire est encore possédé n'est pas ajouté
     * une seconde fois - même règle qu'à l'analyse, revérifiée ici parce que la
     * collection a pu changer entre les deux.
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
