package com.iozycore.core.api.tag;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.EntityRepository;
import com.iozycore.core.domain.catalog.Tag;
import com.iozycore.core.domain.catalog.TagRepository;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Les tags : des étiquettes libres posées sur une ŒUVRE, jamais sur un tome ni
 * sur un exemplaire.
 *
 * <h2>Partagés, et administrés (2026-08-30)</h2>
 * Un tag décrit l'œuvre elle-même - « seinen », « one-shot », « adapté en
 * animé » - au même titre que sa catégorie ou son édition de référence. Il vit
 * donc dans le catalogue <b>partagé</b> : une œuvre est la même pour tout le
 * monde, et son étiquette aussi.
 * <p>
 * C'est précisément pour ça que les poser est <b>administratif</b> (voir
 * SecurityConfig) : sans cette règle, n'importe quel compte étiquetterait les
 * œuvres de tous les autres. Tout le monde les <b>lit</b> - c'est ce qui rend
 * le filtre de Ma collection utilisable.
 * <p>
 * Ce qui suit de ce choix : un tag n'est pas l'endroit où noter « prêté à
 * Marc » ou « à revendre ». Ces choses-là sont personnelles, elles n'ont rien
 * à faire dans un catalogue commun, et rien ici ne les accueille.
 */
@RestController
@RequestMapping("/api/tags")
public class TagController {

    public record CreateTagRequest(String label) {
    }

    public record RenommerTagRequest(String label) {
    }

    private final TagRepository tagRepository;
    private final EntityRepository entityRepository;

    public TagController(TagRepository tagRepository, EntityRepository entityRepository) {
        this.tagRepository = tagRepository;
        this.entityRepository = entityRepository;
    }

    @Operation(summary = "Créer un Tag (réutilisable sur plusieurs Entity)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Tag create(@RequestBody CreateTagRequest request) {
        return tagRepository.findByLabel(request.label())
                .orElseGet(() -> tagRepository.save(new Tag(UUID.randomUUID(), request.label())));
    }

    @Operation(summary = "Lister tous les Tags existants")
    @GetMapping
    public List<Tag> listAll() {
        return tagRepository.findAll();
    }

    @Operation(summary = "Associer un Tag existant à une Entity")
    @PostMapping("/entities/{entityId}/{tagId}")
    public void attachToEntity(@PathVariable UUID entityId, @PathVariable UUID tagId) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        // Le Tag aussi doit exister. Sans ce contrôle, seule la clé étrangère
        // protégeait la table : le client recevait un 409 « Cette donnée entre
        // en conflit avec une donnée existante » alors que le tag est ABSENT,
        // pas conflictuel - et la ligne au-dessus rendait déjà, pour l'entité,
        // le 404 que ce cas mérite tout autant.
        if (tagRepository.findById(tagId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag introuvable : " + tagId);
        }
        entity.addTag(tagId);
        entityRepository.save(entity);
    }

    @Operation(summary = "Renommer un Tag - réservé aux administrateurs")
    @PatchMapping("/{tagId}")
    public Tag renommer(@PathVariable UUID tagId, @RequestBody RenommerTagRequest request) {
        Tag existant = tagRepository.findById(tagId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag introuvable : " + tagId));
        String libelle = request.label() == null ? "" : request.label().trim();
        if (libelle.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le libellé d'un tag ne peut pas être vide.");
        }
        // Un libellé est unique en base : le dire ici plutôt que de laisser
        // remonter une violation de contrainte, que personne ne peut lire.
        // Se renommer soi-même à l'identique reste permis - c'est un
        // non-changement, pas un conflit.
        if (tagRepository.findByLabel(libelle).filter(autre -> !autre.id().equals(tagId)).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Un tag porte déjà ce nom.");
        }
        return tagRepository.save(new Tag(existant.id(), libelle));
    }

    @Operation(summary = "Supprimer un Tag et le retirer de toutes les œuvres - réservé aux administrateurs")
    @DeleteMapping("/{tagId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable UUID tagId) {
        if (tagRepository.findById(tagId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tag introuvable : " + tagId);
        }
        // Les rattachements partent avec, par la clé étrangère : une œuvre ne
        // perd que l'étiquette, jamais autre chose.
        tagRepository.supprimer(tagId);
    }

    @Operation(summary = "Retirer un Tag d'une Entity")
    @DeleteMapping("/entities/{entityId}/{tagId}")
    public void detachFromEntity(@PathVariable UUID entityId, @PathVariable UUID tagId) {
        Entity entity = entityRepository.findById(entityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Entity introuvable : " + entityId));
        entity.removeTag(tagId);
        entityRepository.save(entity);
    }
}
