package com.iozycore.videogame.igdb;

import com.iozycore.videogame.franchise.FranchiseGame;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** What IGDB says about the licence of a game (inline fixtures, no network). */
class IgdbFranchiseFetcherTest {

    @Test
    void the_collection_names_the_licence_and_both_kinds_of_group_are_asked() {
        IgdbFranchiseFetcher.Groups groups = IgdbFranchiseFetcher.parseGroups("""
                [{"id": 7346, "collections": [{"id": 106, "name": "The Legend of Zelda"}],
                  "franchises": [{"id": 596, "name": "Zelda"}]}]""");

        assertThat(groups.name()).isEqualTo("The Legend of Zelda");
        assertThat(groups.where()).isEqualTo("(collections = (106) | franchises = (596))");
    }

    @Test
    void a_game_without_licence_has_no_group() {
        assertThat(IgdbFranchiseFetcher.parseGroups("[{\"id\": 1}]").isEmpty()).isTrue();
        assertThat(IgdbFranchiseFetcher.parseGroups("oops").isEmpty()).isTrue();
    }

    @Test
    void keeps_the_games_with_cover_consoles_and_date_and_drops_dlc_and_bundles() {
        List<FranchiseGame> games = IgdbFranchiseFetcher.parseGames("""
                [{"id": 119388, "name": "Tears of the Kingdom", "game_type": 0,
                  "cover": {"url": "//images.igdb.com/igdb/image/upload/t_thumb/co5vmg.jpg"},
                  "platforms": [{"name": "Nintendo Switch"}], "first_release_date": 1683849600},
                 {"id": 2, "name": "Expansion Pass", "game_type": 1, "platforms": [{"name": "Nintendo Switch"}]},
                 {"id": 3, "name": "Bundle", "category": 3},
                 {"id": 4, "name": "Old game"}]""");

        assertThat(games).extracting(FranchiseGame::name).containsExactly("Tears of the Kingdom", "Old game");
        FranchiseGame tears = games.get(0);
        assertThat(tears.coverUrl()).isEqualTo("https://images.igdb.com/igdb/image/upload/t_cover_big/co5vmg.jpg");
        assertThat(tears.platforms()).containsExactly("Nintendo Switch");
        assertThat(tears.releaseDate()).isEqualTo("2023-05-12");
        assertThat(games.get(1).platforms()).isEmpty();
        assertThat(games.get(1).releaseDate()).isNull();
    }
}
