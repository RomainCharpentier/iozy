package com.iozycore.videogame;

import com.iozycore.core.domain.shared.TexteRecherche;

import java.util.List;
import java.util.Map;

/**
 * One name per console, whatever the way it is written.
 *
 * <p>The console of a copy is free text ("Switch", "PS5", "nintendo switch");
 * IGDB writes the full name ("Nintendo Switch", "PlayStation 5"). Both are
 * brought to the same canonical name: the usual short names are mapped, and
 * the maker's name in front is dropped ("Nintendo Switch" -&gt; "switch").
 * The number stays part of the name: "Switch" is never "Switch 2", "PS4"
 * never "PS5".
 */
final class Consoles {

    private static final List<String> MAKERS = List.of("nintendo ", "sony ", "microsoft ", "sega ");

    private static final Map<String, String> SHORT_NAMES = Map.ofEntries(
            Map.entry("ps1", "playstation"),
            Map.entry("psx", "playstation"),
            Map.entry("ps one", "playstation"),
            Map.entry("ps2", "playstation 2"),
            Map.entry("ps3", "playstation 3"),
            Map.entry("ps4", "playstation 4"),
            Map.entry("ps5", "playstation 5"),
            Map.entry("psp", "playstation portable"),
            Map.entry("vita", "playstation vita"),
            Map.entry("ps vita", "playstation vita"),
            Map.entry("psvita", "playstation vita"),
            Map.entry("ns", "switch"),
            Map.entry("switch 1", "switch"),
            Map.entry("ns2", "switch 2"),
            Map.entry("ds", "ds"),
            Map.entry("nds", "ds"),
            Map.entry("3ds", "3ds"),
            Map.entry("new 3ds", "new 3ds"),
            Map.entry("wiiu", "wii u"),
            Map.entry("ngc", "gamecube"),
            Map.entry("gc", "gamecube"),
            Map.entry("n64", "64"),
            Map.entry("snes", "super nintendo entertainment system"),
            Map.entry("super nintendo", "super nintendo entertainment system"),
            Map.entry("super nes", "super nintendo entertainment system"),
            Map.entry("super famicom", "super nintendo entertainment system"),
            Map.entry("nes", "entertainment system"),
            Map.entry("famicom", "entertainment system"),
            Map.entry("gb", "game boy"),
            Map.entry("gbc", "game boy color"),
            Map.entry("gba", "game boy advance"),
            Map.entry("xbox series", "xbox series x s"),
            Map.entry("xbox series x", "xbox series x s"),
            Map.entry("xbox series s", "xbox series x s"),
            Map.entry("xsx", "xbox series x s"),
            Map.entry("x360", "xbox 360"),
            Map.entry("xone", "xbox one"),
            Map.entry("xbox one x", "xbox one"),
            Map.entry("pc", "pc"),
            Map.entry("windows", "pc"),
            Map.entry("pc windows", "pc"),
            Map.entry("pc microsoft windows", "pc"),
            Map.entry("mac", "mac"),
            Map.entry("macos", "mac"),
            Map.entry("dreamcast", "dreamcast"),
            Map.entry("mega drive", "mega drive genesis"),
            Map.entry("genesis", "mega drive genesis"));

    private Consoles() {
    }

    /** The canonical name of a console, or "" when nothing is written. */
    static String canonical(String written) {
        String name = TexteRecherche.normaliser(written);
        String known = SHORT_NAMES.get(name);
        if (known != null) {
            return known;
        }
        for (String maker : MAKERS) {
            if (name.startsWith(maker)) {
                String rest = name.substring(maker.length());
                return SHORT_NAMES.getOrDefault(rest, rest);
            }
        }
        return name;
    }
}
