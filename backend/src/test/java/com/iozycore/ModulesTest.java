package com.iozycore;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * The module boundaries, checked on every build (Batch 133): one open
 * core and four closed universes, with no dependency from the core to a universe,
 * none between universes, no cycle. The test also draws the map
 * of the modules in target/spring-modulith-docs.
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
