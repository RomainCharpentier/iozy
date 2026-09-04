package com.iozycore.insights;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.Tag;
import com.iozycore.domain.catalog.TagRepository;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.tierlist.EntityRank;
import com.iozycore.domain.tierlist.EntityRankRepository;
import com.iozycore.domain.wishlist.WishlistEntry;
import com.iozycore.domain.wishlist.WishlistEntryRepository;
import com.iozycore.purchaseanalysis.ConfidenceLevel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * « Quels mangas j'ai commencés sans finir ? » - la collection interrogee en
 * francais (V3 de docs/CONCEPTION.md §15).
 *
 * <h2>Ce que le modele recoit</h2>
 * Pas la base : un <b>instantane</b> compact, une ligne JSON par oeuvre qui
 * a un lien reel avec l'utilisateur (un exemplaire, une envie, une
 * experience) - titre, type, auteur, tomes possedes sur total, prix paye,
 * experiences datees et notees, envie, rang, tags. Rien d'autre : ni
 * identifiants de compte, ni jetons, ni les oeuvres du catalogue qui ne sont
 * a personne. Un instantane de 500 series tient dans une dizaine de milliers
 * de tokens, tres loin de la fenetre d'un modele Flash.
 *
 * <h2>La garantie, et sa limite</h2>
 * Le modele doit citer les oeuvres qu'il utilise par leur identifiant ; le
 * service ne garde que ceux qui existent dans l'instantane. Une reponse
 * arrive donc toujours avec de vraies fiches a ouvrir pour la verifier.
 * Le texte, lui, n'est pas verifie - il est presente comme celui d'une IA,
 * jamais persiste, jamais melange aux donnees (meme regle qu'en Analyse
 * d'achat).
 */
@Service
public class CollectionQuestionService {

    private static final Logger log = LoggerFactory.getLogger(CollectionQuestionService.class);

    /** Au-dela, on tronque en gardant les oeuvres les plus recemment acquises - et on le dit dans l'instantane. */
    static final int OEUVRES_MAX = 1500;
    static final int QUESTION_MAX = 500;

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final TagRepository tagRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;
    private final WishlistEntryRepository wishlistEntryRepository;
    private final EntityRankRepository entityRankRepository;
    private final CollectionProgressService collectionProgressService;
    private final AiCollectionOracle oracle;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CollectionQuestionService(EntityRepository entityRepository, EntityTypeRepository entityTypeRepository,
                                     TagRepository tagRepository, OwnershipRepository ownershipRepository,
                                     ExperienceRepository experienceRepository,
                                     WishlistEntryRepository wishlistEntryRepository,
                                     EntityRankRepository entityRankRepository,
                                     CollectionProgressService collectionProgressService,
                                     AiCollectionOracle oracle) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.tagRepository = tagRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
        this.wishlistEntryRepository = wishlistEntryRepository;
        this.entityRankRepository = entityRankRepository;
        this.collectionProgressService = collectionProgressService;
        this.oracle = oracle;
    }

    public boolean estDisponible() {
        return oracle.estConfigure();
    }

    /**
     * @return vide si le modele n'a pas repondu ou a repondu n'importe quoi -
     *         le controleur en fait un 503, jamais une reponse vide affichee
     *         comme si elle venait de la collection
     */
    public Optional<CollectionAnswer> repondre(String question) {
        if (question == null || question.isBlank()) {
            throw new IllegalArgumentException("La question est vide");
        }
        if (question.length() > QUESTION_MAX) {
            throw new IllegalArgumentException("La question dépasse " + QUESTION_MAX + " caractères");
        }
        Map<UUID, String> titres = new HashMap<>();
        String instantane = construireInstantane(titres);
        Optional<String> brut = oracle.repondre(instantane, question.trim());
        if (brut.isEmpty()) {
            return Optional.empty();
        }
        try {
            return Optional.of(interpreter(brut.get(), titres));
        } catch (Exception e) {
            log.warn("Réponse du modèle illisible : {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ----- l'instantane -------------------------------------------------------------------

    String construireInstantane(Map<UUID, String> titresParId) {
        Map<UUID, EntityType> types = entityTypeRepository.findAll().stream()
                .collect(Collectors.toMap(EntityType::id, t -> t));
        Map<UUID, String> tags = tagRepository.findAll().stream().collect(Collectors.toMap(Tag::id, Tag::label));
        Map<UUID, List<Ownership>> possessions = ownershipRepository.findAll().stream()
                .filter(Ownership::isActive)
                .collect(Collectors.groupingBy(Ownership::entityId));
        Map<UUID, List<Experience>> experiences = experienceRepository.findAll().stream()
                .collect(Collectors.groupingBy(Experience::entityId));
        Set<UUID> envies = wishlistEntryRepository.findAll().stream()
                .map(WishlistEntry::entityId).collect(Collectors.toSet());
        Map<UUID, CollectionProgress> progression = collectionProgressService.computeAll().stream()
                .collect(Collectors.toMap(CollectionProgress::entityId, p -> p, (a, b) -> a));

        List<Entity> oeuvres = new ArrayList<>();
        for (EntityType type : types.values()) {
            oeuvres.addAll(entityRepository.findAllByType(type.id()));
        }
        // Seules les oeuvres qui ont un lien REEL avec l'utilisateur : le
        // catalogue partage contient aussi celles des autres comptes.
        oeuvres.removeIf(e -> !possessions.containsKey(e.id()) && !experiences.containsKey(e.id())
                && !envies.contains(e.id()));
        Map<UUID, EntityRank> rangs = entityRankRepository
                .findByEntityIds(oeuvres.stream().map(Entity::id).collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(EntityRank::entityId, r -> r));

        // Les plus recemment acquises d'abord, pour que la troncature (rare)
        // garde ce dont on parle le plus probablement.
        oeuvres.sort(Comparator.comparing((Entity e) -> derniereAcquisition(possessions.get(e.id())),
                Comparator.nullsLast(Comparator.reverseOrder())));
        boolean tronque = oeuvres.size() > OEUVRES_MAX;
        List<Entity> retenues = tronque ? oeuvres.subList(0, OEUVRES_MAX) : oeuvres;

        List<Map<String, Object>> lignes = new ArrayList<>();
        for (Entity e : retenues) {
            titresParId.put(e.id(), e.title());
            lignes.add(ligne(e, types.get(e.entityTypeId()), tags, possessions.get(e.id()), experiences.get(e.id()),
                    envies.contains(e.id()), rangs.get(e.id()), progression.get(e.id())));
        }

        Map<String, Object> racine = new LinkedHashMap<>();
        racine.put("aujourdhui", LocalDate.now().toString());
        racine.put("nombreOeuvres", oeuvres.size());
        if (tronque) {
            racine.put("avertissement", "seules les " + OEUVRES_MAX + " oeuvres les plus recentes sont listees");
        }
        racine.put("oeuvres", lignes);
        try {
            return objectMapper.writeValueAsString(racine);
        } catch (Exception e) {
            throw new IllegalStateException("Instantané de collection impossible à sérialiser", e);
        }
    }

    private static Map<String, Object> ligne(Entity e, EntityType type, Map<UUID, String> tags,
                                             List<Ownership> possessions, List<Experience> experiences,
                                             boolean envie, EntityRank rang, CollectionProgress progression) {
        Map<String, Object> l = new LinkedHashMap<>();
        l.put("id", e.id().toString());
        l.put("titre", e.title());
        l.put("type", type == null ? null : type.label());
        String auteur = premierTexte(e.attributes(), "mangaka", "author", "studio", "designer", "developer");
        if (auteur != null) {
            l.put("auteur", auteur);
        }
        Object annee = e.attributes().get("startYear");
        if (annee == null) {
            annee = e.attributes().get("yearPublished");
        }
        if (annee != null) {
            l.put("annee", annee.toString());
        }
        if (possessions != null && !possessions.isEmpty()) {
            l.put("exemplaires", possessions.size());
            LocalDate premiere = possessions.stream().map(Ownership::acquiredAt).filter(Objects::nonNull)
                    .min(Comparator.naturalOrder()).orElse(null);
            LocalDate derniere = derniereAcquisition(possessions);
            if (premiere != null) {
                l.put("premiereAcquisition", premiere.toString());
            }
            if (derniere != null && !derniere.equals(premiere)) {
                l.put("derniereAcquisition", derniere.toString());
            }
            BigDecimal total = possessions.stream().map(o -> o.purchasePrice().orElse(null)).filter(Objects::nonNull)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            long renseignes = possessions.stream().filter(o -> o.purchasePrice().isPresent()).count();
            if (renseignes > 0) {
                l.put("prixPayeTotalEuros", total);
                if (renseignes < possessions.size()) {
                    l.put("prixConnusSur", renseignes + "/" + possessions.size());
                }
            }
        }
        if (progression != null && progression.dominantEdition() != null) {
            CollectionProgress.EditionProgress ed = progression.dominantEdition();
            l.put("edition", ed.editionName());
            l.put("tomesPossedes", ed.ownedCount());
            if (ed.totalVolumes() != null) {
                l.put("tomesTotal", ed.totalVolumes());
                l.put("serieComplete", ed.ownedCount() >= ed.totalVolumes());
            }
            if (!ed.ownedVolumeNumbers().isEmpty()) {
                l.put("numerosPossedes", plages(ed.ownedVolumeNumbers()));
            }
        }
        if (experiences != null && !experiences.isEmpty()) {
            List<Map<String, Object>> xs = new ArrayList<>();
            experiences.stream().sorted(Comparator.comparing(Experience::occurredAt)).forEach(x -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("type", x.experienceType());
                m.put("date", x.occurredAt().toString());
                x.rating().ifPresent(n -> m.put("note", n));
                if (x.comment() != null && !x.comment().isBlank()) {
                    m.put("commentaire", x.comment());
                }
                xs.add(m);
            });
            l.put("experiences", xs);
        }
        if (envie) {
            l.put("enEnvies", true);
        }
        if (rang != null) {
            l.put("rang", rang.rank().name());
        }
        List<String> libelles = e.tagIds().stream().map(tags::get).filter(Objects::nonNull).toList();
        if (!libelles.isEmpty()) {
            l.put("tags", libelles);
        }
        return l;
    }

    private static LocalDate derniereAcquisition(List<Ownership> possessions) {
        if (possessions == null) {
            return null;
        }
        return possessions.stream().map(Ownership::acquiredAt).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(null);
    }

    private static String premierTexte(Map<String, Object> attributs, String... cles) {
        for (String cle : cles) {
            Object v = attributs.get(cle);
            if (v instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        return null;
    }

    /** [1,2,3,5,7,8] -> "1-3, 5, 7-8" : lisible par le modele, quatre fois plus court qu'une liste. */
    static String plages(List<Integer> numeros) {
        List<Integer> tries = numeros.stream().distinct().sorted().toList();
        StringBuilder sb = new StringBuilder();
        int i = 0;
        while (i < tries.size()) {
            int debut = tries.get(i);
            int fin = debut;
            while (i + 1 < tries.size() && tries.get(i + 1) == fin + 1) {
                fin = tries.get(++i);
            }
            if (sb.length() > 0) {
                sb.append(", ");
            }
            sb.append(debut == fin ? String.valueOf(debut) : debut + "-" + fin);
            i++;
        }
        return sb.toString();
    }

    // ----- la reponse ---------------------------------------------------------------------

    CollectionAnswer interpreter(String texteBrut, Map<UUID, String> titresParId) throws Exception {
        JsonNode json = objectMapper.readTree(texteBrut);
        String reponse = json.path("reponse").asText(null);
        if (reponse == null || reponse.isBlank()) {
            throw new IllegalStateException("aucun champ 'reponse'");
        }
        List<CollectionAnswer.Reference> references = new ArrayList<>();
        Set<UUID> vus = new java.util.HashSet<>();
        for (JsonNode n : json.path("oeuvres")) {
            UUID id;
            try {
                id = UUID.fromString(n.asText(""));
            } catch (IllegalArgumentException e) {
                continue; // un identifiant invente ou mal forme ne devient jamais un lien
            }
            String titre = titresParId.get(id);
            if (titre != null && vus.add(id)) {
                references.add(new CollectionAnswer.Reference(id, titre));
            }
        }
        ConfidenceLevel confiance;
        try {
            confiance = ConfidenceLevel.valueOf(json.path("confiance").asText("").trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            confiance = ConfidenceLevel.LOW;
        }
        return new CollectionAnswer(reponse.trim(), references, confiance, oracle.getClass().getSimpleName());
    }
}
