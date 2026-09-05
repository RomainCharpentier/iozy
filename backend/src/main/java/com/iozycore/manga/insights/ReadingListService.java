package com.iozycore.manga.insights;

import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityType;
import com.iozycore.domain.catalog.EntityTypeRepository;
import com.iozycore.domain.catalog.Variant;
import com.iozycore.domain.experience.Experience;
import com.iozycore.domain.experience.ExperienceRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * « Qu'est-ce que je lis ensuite ? » - la question que la collection savait
 * deja repondre sans que personne ne la pose.
 *
 * <h2>Calcule, jamais tenu a jour</h2>
 * Aucune table, aucune file d'attente a curer : la reponse se deduit de deux
 * faits deja enregistres - ce qu'on POSSEDE ({@code Ownership} active) et ce
 * qu'on a VECU ({@code Experience}). Un tome entre dans la liste en etant
 * achete et en sort en etant lu, sans qu'aucun ecran n'ait a s'en souvenir.
 * C'est aussi ce qui evite l'ecran vide du premier jour : la liste est pleine
 * des l'instant ou la collection l'est.
 *
 * <h2>Toute experience compte comme « vecu »</h2>
 * Et non les seuls types « lu » : le vocabulaire des experiences est
 * configurable par categorie ({@code EntityType.allowedExperienceTypes}, ou
 * un type personnalise peut n'avoir ni READ ni FINISHED). Une serie abandonnee
 * sort donc de la liste au tome abandonne - ce qui est le comportement voulu :
 * elle ne se « lit pas ensuite ».
 *
 * <h2>L'ordre des series repond a la question</h2>
 * Les series COMMENCEES d'abord (au moins un tome vecu) : « reprendre »
 * passe avant « commencer ». Puis, a l'interieur, celle dont il reste le
 * moins - la plus proche d'etre finie. Le titre departage, pour que deux
 * visites de suite montrent la meme chose.
 *
 * <p>Les oeuvres qui ne se collectionnent pas par tome (un jeu, un film) sont
 * hors sujet ici : leur exemplaire n'a pas de tome, et « le prochain tome »
 * n'y veut rien dire. Elles sont ecartees en ne gardant que les possessions
 * qui portent un {@code variantId}.
 */
@Service
public class ReadingListService {

    private static final String VOLUME_NUMBER = "volumeNumber";
    private static final String COVER_IMAGE_URL = "coverImageUrl";
    private static final String EDITION = "edition";

    private final EntityRepository entityRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final OwnershipRepository ownershipRepository;
    private final ExperienceRepository experienceRepository;

    public ReadingListService(EntityRepository entityRepository, EntityTypeRepository entityTypeRepository,
                              OwnershipRepository ownershipRepository, ExperienceRepository experienceRepository) {
        this.entityRepository = entityRepository;
        this.entityTypeRepository = entityTypeRepository;
        this.ownershipRepository = ownershipRepository;
        this.experienceRepository = experienceRepository;
    }

    @Transactional(readOnly = true)
    public ReadingList compute() {
        // Un seul chargement de chaque agregat, jamais une requete par serie :
        // c'est le meme piege que les deux N+1 des lots 113-114.
        Map<UUID, EntityType> typesById = entityTypeRepository.findAll().stream()
                .collect(Collectors.toMap(EntityType::id, t -> t));
        List<Entity> oeuvres = new ArrayList<>();
        for (EntityType type : typesById.values()) {
            oeuvres.addAll(entityRepository.findAllByType(type.id()));
        }

        Map<UUID, Set<UUID>> tomesPossedesParOeuvre = new HashMap<>();
        for (Ownership ownership : ownershipRepository.findAll()) {
            if (!ownership.isActive()) {
                continue;
            }
            ownership.variantId().ifPresent(variantId ->
                    tomesPossedesParOeuvre.computeIfAbsent(ownership.entityId(), id -> new HashSet<>()).add(variantId));
        }
        if (tomesPossedesParOeuvre.isEmpty()) {
            return new ReadingList(List.of(), 0);
        }

        Set<UUID> tomesVecus = experienceRepository.findAll().stream()
                .map(Experience::variantId)
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .collect(Collectors.toSet());

        List<ReadingList.Serie> series = new ArrayList<>();
        int total = 0;
        for (Entity oeuvre : oeuvres) {
            Set<UUID> possedes = tomesPossedesParOeuvre.get(oeuvre.id());
            if (possedes == null) {
                continue;
            }
            List<Variant> aLire = oeuvre.variants().stream()
                    .filter(v -> possedes.contains(v.id()) && !tomesVecus.contains(v.id()))
                    .sorted(Comparator.comparing(ReadingListService::numeroDe,
                            Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();
            if (aLire.isEmpty()) {
                continue;
            }
            long lus = possedes.stream().filter(tomesVecus::contains).count();
            Variant prochain = aLire.get(0);
            EntityType type = typesById.get(oeuvre.entityTypeId());
            series.add(new ReadingList.Serie(
                    oeuvre.id(), oeuvre.title(), type == null ? null : type.label(),
                    texte(oeuvre.attributes().get(COVER_IMAGE_URL)),
                    new ReadingList.Tome(prochain.id(), prochain.label(), numeroDe(prochain),
                            texte(prochain.attributes().get(EDITION)),
                            texte(prochain.attributes().get(COVER_IMAGE_URL))),
                    aLire.size(), (int) lus, lus > 0));
            total += aLire.size();
        }

        series.sort(Comparator.comparing(ReadingList.Serie::commencee).reversed()
                .thenComparingInt(ReadingList.Serie::restants)
                .thenComparing(ReadingList.Serie::titre, String.CASE_INSENSITIVE_ORDER));
        return new ReadingList(List.copyOf(series), total);
    }

    /** Les attributs sont un sac non type : un meme champ arrive en Integer d'un
     * fournisseur et en String d'un autre (meme garde que CollectionProgressService). */
    private static Integer numeroDe(Variant variant) {
        Object value = variant.attributes().get(VOLUME_NUMBER);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static String texte(Object value) {
        return value instanceof String s && !s.isBlank() ? s : null;
    }
}
