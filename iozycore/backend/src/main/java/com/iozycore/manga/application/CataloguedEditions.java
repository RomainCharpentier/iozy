package com.iozycore.manga.application;

import com.iozycore.core.domain.catalog.Entity;
import com.iozycore.core.domain.catalog.Variant;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * The named editions of a series, read from its catalogued volumes, with the
 * highest volume number known for each.
 *
 * <p>Same grouping as {@code CollectionProgressService}: a volume without an
 * edition name joins the edition when the series has exactly ONE named
 * edition (a volume added by hand without retyping the name); with two or
 * more, it belongs to none. Names are compared without case; the first
 * spelling met is kept.
 */
public final class CataloguedEditions {

    private static final String EDITION = "edition";
    private static final String VOLUME_NUMBER = "volumeNumber";

    private CataloguedEditions() {
    }

    /** Edition name -> highest volume number catalogued in it, in the order met. */
    public static Map<String, Integer> of(Entity entity) {
        Map<String, String> spellings = new LinkedHashMap<>();
        Map<String, Integer> highestByKey = new LinkedHashMap<>();
        int highestUnnamed = 0;
        for (Variant variant : entity.variants()) {
            Integer number = volumeNumberOf(variant);
            if (number == null) {
                continue;
            }
            String name = editionOf(variant);
            if (name.isEmpty()) {
                highestUnnamed = Math.max(highestUnnamed, number);
                continue;
            }
            String key = name.toLowerCase(Locale.ROOT);
            spellings.putIfAbsent(key, name);
            highestByKey.merge(key, number, Math::max);
        }
        Map<String, Integer> result = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : spellings.entrySet()) {
            int highest = highestByKey.get(entry.getKey());
            if (spellings.size() == 1) {
                highest = Math.max(highest, highestUnnamed);
            }
            result.put(entry.getValue(), highest);
        }
        return result;
    }

    private static String editionOf(Variant variant) {
        Object value = variant.attributes().get(EDITION);
        return value instanceof String s ? s.trim() : "";
    }

    /** The attributes are an untyped bag: the number arrives as a number from one provider, as text from another. */
    private static Integer volumeNumberOf(Variant variant) {
        Object value = variant.attributes().get(VOLUME_NUMBER);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}
