package com.iozycore.videogame;

import com.iozycore.core.application.ShelfDetailsSource;
import org.springframework.stereotype.Component;

import java.util.List;

/** The shelves of video games read the publisher and the consoles, which IGDB gives by its id. */
@Component
public class VideoGameShelfDetails implements ShelfDetailsSource {

    @Override
    public String entityTypeCode() {
        return "VIDEO_GAME";
    }

    @Override
    public String sourceIdKey() {
        return "igdbId";
    }

    @Override
    public List<String> shelfKeys() {
        return List.of("publisher", "platforms");
    }
}
