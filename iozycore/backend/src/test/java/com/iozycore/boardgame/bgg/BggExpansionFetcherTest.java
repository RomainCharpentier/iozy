package com.iozycore.boardgame.bgg;

import com.iozycore.boardgame.expansion.BoardGameExpansion;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** What the /thing answers of BGG say about expansions (inline fixtures, no network). */
class BggExpansionFetcherTest {

    @Test
    void a_base_game_lists_its_expansions_and_not_the_inbound_links() {
        String xml = """
                <items><item type="boardgame" id="13">
                  <name type="primary" value="CATAN"/>
                  <link type="boardgamecategory" id="1" value="Negotiation"/>
                  <link type="boardgameexpansion" id="325" value="Catan: Seafarers"/>
                  <link type="boardgameexpansion" id="926" value="Catan: Cities &amp; Knights"/>
                  <link type="boardgameexpansion" id="325" value="Catan: Seafarers"/>
                  <link type="boardgameexpansion" id="5" value="Base of something" inbound="true"/>
                </item></items>""";

        List<BoardGameExpansion> expansions = BggExpansionFetcher.parseLinks(xml);

        assertThat(expansions).extracting(BoardGameExpansion::bggId).containsExactly("325", "926");
        assertThat(expansions.get(1).name()).isEqualTo("Catan: Cities & Knights");
    }

    @Test
    void an_unreadable_or_empty_answer_gives_no_expansion() {
        assertThat(BggExpansionFetcher.parseLinks("<items></items>")).isEmpty();
        assertThat(BggExpansionFetcher.parseLinks("not xml")).isEmpty();
    }

    @Test
    void the_covers_of_several_expansions_come_from_one_answer() {
        String xml = """
                <items>
                  <item type="boardgameexpansion" id="325"><image>https://cf.geekdo-images.com/sea.jpg</image>
                    <yearpublished value="1997"/></item>
                  <item type="boardgameexpansion" id="926"><yearpublished value="0"/></item>
                </items>""";

        Map<String, BggExpansionFetcher.Cover> covers = BggExpansionFetcher.parseCovers(xml);

        assertThat(covers.get("325")).isEqualTo(new BggExpansionFetcher.Cover("https://cf.geekdo-images.com/sea.jpg",
                "1997"));
        assertThat(covers.get("926")).isEqualTo(new BggExpansionFetcher.Cover(null, null));
    }
}
