package com.iozycore;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Clean architecture inside each module: a REST controller only translates HTTP.
 * It calls a use case (application service), never a repository. The business
 * rules and the errors they raise live in the use case, so that they hold
 * whatever the caller.
 *
 * <p>The domain, in turn, is the innermost layer: it knows no framework and
 * depends on no outer layer (use cases, HTTP, persistence). Batch 170 put
 * core/insights and manga/deals under these rules.
 */
class LayersTest {

    private final JavaClasses classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.iozycore");

    @Test
    void controllers_call_use_cases_not_repositories() {
        noClasses()
                .that().areAnnotatedWith(RestController.class)
                .should().dependOnClassesThat(DescribedPredicate.describe("are iozycore repositories",
                        target -> target.getPackageName().startsWith("com.iozycore")
                                && target.getSimpleName().endsWith("Repository")))
                .check(classes);
    }

    @Test
    void the_domain_knows_no_framework() {
        noClasses()
                .that().resideInAPackage("com.iozycore..domain..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("org.springframework..", "jakarta.persistence..", "org.hibernate..")
                .check(classes);
    }

    @Test
    void the_domain_depends_on_no_outer_layer() {
        noClasses()
                .that().resideInAPackage("com.iozycore..domain..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("com.iozycore..application..", "com.iozycore..api..",
                        "com.iozycore..infrastructure..")
                .check(classes);
    }

    @Test
    void use_cases_know_no_http() {
        noClasses()
                .that().resideInAPackage("com.iozycore..application..")
                .should().dependOnClassesThat()
                .resideInAnyPackage("org.springframework.web..", "org.springframework.http..",
                        "com.iozycore..api..")
                .check(classes);
    }

    @Test
    void use_cases_know_no_infrastructure() {
        noClasses()
                .that().resideInAPackage("com.iozycore..application..")
                .should().dependOnClassesThat().resideInAPackage("com.iozycore..infrastructure..")
                .check(classes);
    }
}
