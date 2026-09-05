package com.iozycore.core.infrastructure.persistence.ownership;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OwnershipJpaRepository extends JpaRepository<OwnershipJpaEntity, UUID> {

    /**
     * Charger par identifiant, mais PAR UNE REQUÊTE.
     *
     * <p>{@code findById} de JPA charge par clé primaire sans passer par une
     * requête : Hibernate n'y applique pas le cloisonnement par propriétaire
     * (voir ProprietaireCourant), et la ligne d'un AUTRE compte remonte -
     * constaté en écrivant le test d'isolation, qui passait sur les listes et
     * échouait sur les chargements par identifiant. Cette variante est une
     * requête dérivée, donc filtrée comme les autres.
     */
    Optional<OwnershipJpaEntity> findOneById(UUID id);
    List<OwnershipJpaEntity> findByEntityId(UUID entityId);
    boolean existsByEntityId(UUID entityId);
}
