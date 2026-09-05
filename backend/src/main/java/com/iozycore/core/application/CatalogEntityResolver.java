package com.iozycore.core.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Identifier-ou-créer la fiche catalogue d'une œuvre, SANS aucune possession.
 * <p>
 * <b>Catalogue ≠ Collection.</b> Une œuvre peut être connue d'IozyCore sans
 * appartenir à la collection : c'est le cas d'une série mise en envies sans
 * être possédée. Jusqu'ici cette règle n'avait pourtant aucun chemin
 * d'exécution - le seul moyen de faire entrer une œuvre externe dans le
 * catalogue était {@link QuickAddService#addNewEntityWithOwnership}, qui
 * termine toujours par un {@code Ownership.acquire}. Ajouter aux envies une
 * œuvre non possédée était donc impossible sans fabriquer une possession
 * fictive, ce qui aurait violé le modèle.
 * <p>
 * Cette classe extrait la partie « faire exister la fiche » de ce parcours,
 * telle quelle : {@link QuickAddService} l'appelle puis crée sa possession, le
 * parcours Envies l'appelle et s'arrête là. La règle de canonicalisation reste
 * donc écrite <b>une seule fois</b>, et les deux chemins produisent
 * nécessairement la même Entity pour la même œuvre - pas de second catalogue
 * parallèle réservé aux envies.
 * <p>
 * Déduplication : par (type, titre découpé, insensible à la casse), exactement
 * comme avant. Les attributs fournis complètent ceux qui manquent et
 * n'écrasent jamais ceux déjà renseignés - une saisie manuelle antérieure
 * survit à une recherche de métadonnées ultérieure.
 */
@Service
public class CatalogEntityResolver {

    private final EntityRepository entityRepository;

    public CatalogEntityResolver(EntityRepository entityRepository) {
        this.entityRepository = entityRepository;
    }

    /** L'Entity canonique, et si elle existait déjà - jamais un doublon. */
    public record Resolution(Entity entity, boolean matchedExisting) {
    }

    /**
     * Rend la fiche catalogue de cette œuvre, en la créant si elle n'existe pas
     * encore. <b>Ne crée jamais d'Ownership</b> : c'est à l'appelant d'en créer
     * une s'il en veut une.
     */
    @Transactional
    public Resolution resolveOrCreate(UUID entityTypeId, String title, Map<String, Object> prefilledAttributes) {
        String normalizedTitle = title.trim();
        Optional<Entity> existing = entityRepository.findByTypeAndTitle(entityTypeId, normalizedTitle);
        Map<String, Object> attributes = prefilledAttributes == null ? Map.of() : prefilledAttributes;

        if (existing.isPresent()) {
            Entity entity = existing.get();
            attributes.forEach((key, value) -> {
                if (!entity.attributes().containsKey(key)) {
                    entity.setAttribute(key, value);
                }
            });
            return new Resolution(entityRepository.save(entity), true);
        }

        Entity entity = Entity.create(entityTypeId, normalizedTitle);
        attributes.forEach(entity::setAttribute);
        return new Resolution(entityRepository.save(entity), false);
    }
}
