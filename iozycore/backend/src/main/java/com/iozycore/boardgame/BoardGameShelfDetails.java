package com.iozycore.boardgame;

import com.iozycore.core.application.ShelfDetailsSource;
import org.springframework.stereotype.Component;

import java.util.List;

/** The shelves of board games read the publisher, which BoardGameGeek gives by its id. */
@Component
public class BoardGameShelfDetails implements ShelfDetailsSource {

    @Override
    public String entityTypeCode() {
        return "BOARD_GAME";
    }

    @Override
    public String sourceIdKey() {
        return "bggId";
    }

    @Override
    public List<String> shelfKeys() {
        return List.of("publisher");
    }
}
