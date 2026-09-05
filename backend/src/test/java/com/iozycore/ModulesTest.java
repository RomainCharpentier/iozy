package com.iozycore;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * Les frontières du modulith, vérifiées à chaque build (Lot 133) : un cœur
 * ouvert et quatre univers fermés, sans dépendance du cœur vers un univers,
 * sans dépendance entre univers, sans cycle. Le test dessine aussi la carte
 * des modules dans target/spring-modulith-docs.
 */
class ModulesTest {

    @Test
    void un_coeur_et_quatre_univers_aux_frontieres_tenues() {
        ApplicationModules modules = ApplicationModules.of(IozyCoreApplication.class);
        modules.forEach(module -> System.out.println("module : " + module.getDisplayName()));
        modules.verify();
        new Documenter(modules).writeDocumentation();
    }
}
