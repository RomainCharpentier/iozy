package com.iozycore.integration;

import com.iozycore.application.OwnershipDeletionService;
import com.iozycore.domain.catalog.Entity;
import com.iozycore.domain.catalog.EntityRepository;
import com.iozycore.domain.catalog.EntityTypeFixtures;
import com.iozycore.domain.loan.Loan;
import com.iozycore.domain.loan.LoanRepository;
import com.iozycore.domain.ownership.Ownership;
import com.iozycore.domain.ownership.OwnershipCondition;
import com.iozycore.domain.ownership.OwnershipRepository;
import com.iozycore.domain.shared.OwnershipDeletionNotAllowedException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Validates the Loan persistence module (Flyway V5 + JPA) against a real PostgreSQL - mirrors EntityPersistenceIntegrationTest. */
@Testcontainers
@SpringBootTest
@Transactional
class LoanPersistenceIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("iozycore_test")
            .withUsername("iozycore")
            .withPassword("iozycore");

    @DynamicPropertySource
    static void configureDatasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private LoanRepository loanRepository;

    @Autowired
    private OwnershipRepository ownershipRepository;

    @Autowired
    private EntityRepository entityRepository;

    @Autowired
    private OwnershipDeletionService ownershipDeletionService;

    private UUID createOwnedEntityOwnership() {
        Entity entity = entityRepository.save(Entity.create(EntityTypeFixtures.MANGA.id(), "Vagabond " + UUID.randomUUID()));
        Ownership ownership = Ownership.acquire(entity.id(), null, OwnershipCondition.NEW, LocalDate.now(), null);
        ownershipRepository.save(ownership);
        return ownership.id();
    }

    @Test
    void a_loan_can_be_saved_reloaded_and_marked_returned() {
        UUID ownershipId = createOwnedEntityOwnership();
        Loan loan = loanRepository.save(Loan.lend(ownershipId, "Alex", LocalDate.now(), "Pour les vacances"));

        assertThat(loanRepository.findById(loan.id())).isPresent();
        assertThat(loanRepository.findAllActive()).extracting(Loan::id).contains(loan.id());

        Loan reloaded = loanRepository.findById(loan.id()).orElseThrow();
        reloaded.markReturned(LocalDate.now());
        loanRepository.save(reloaded);

        assertThat(loanRepository.findAllActive()).extracting(Loan::id).doesNotContain(loan.id());
        assertThat(loanRepository.findByOwnershipId(ownershipId)).hasSize(1);
    }

    @Test
    void findAllActive_never_reports_a_returned_loan() {
        UUID ownershipId = createOwnedEntityOwnership();
        Loan returned = loanRepository.save(Loan.lend(ownershipId, "Sam", LocalDate.now().minusDays(30), null));
        returned.markReturned(LocalDate.now());
        loanRepository.save(returned);

        UUID otherOwnershipId = createOwnedEntityOwnership();
        Loan active = loanRepository.save(Loan.lend(otherOwnershipId, "Jo", LocalDate.now(), null));

        assertThat(loanRepository.findAllActive()).extracting(Loan::id)
                .contains(active.id())
                .doesNotContain(returned.id());
    }

    @Test
    void an_ownership_with_no_loan_at_all_can_be_deleted() {
        UUID ownershipId = createOwnedEntityOwnership();

        ownershipDeletionService.delete(ownershipId);

        assertThat(ownershipRepository.findById(ownershipId)).isEmpty();
    }

    @Test
    void an_ownership_still_referenced_by_a_loan_cannot_be_deleted_even_once_returned() {
        // "même déjà rendu" (voir EntityDeletionNotAllowedException et sa javadoc) : un Loan rendu reste
        // un historique réel, jamais un simple état transitoire à ignorer une fois de retour.
        UUID ownershipId = createOwnedEntityOwnership();
        Loan loan = loanRepository.save(Loan.lend(ownershipId, "Alex", LocalDate.now(), null));
        loan.markReturned(LocalDate.now());
        loanRepository.save(loan);

        assertThatThrownBy(() -> ownershipDeletionService.delete(ownershipId))
                .isInstanceOf(OwnershipDeletionNotAllowedException.class)
                .hasMessageContaining("1 prêt");

        assertThat(ownershipRepository.findById(ownershipId)).isPresent();
    }
}
