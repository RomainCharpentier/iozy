package com.iozycore.videogame.igdb;

import com.iozycore.core.metadata.SourceUnavailableException;
import com.iozycore.videogame.franchise.FranchiseGame;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
        assertThat(IgdbFranchiseFetcher.parseGroups("[]").isEmpty()).isTrue();
    }

    @Test
    void an_error_body_or_text_that_is_not_json_is_no_answer_and_is_never_stored_as_no_licence() {
        assertThatThrownBy(() -> IgdbFranchiseFetcher.parseGroups("oops"))
                .isInstanceOf(SourceUnavailableException.class);
        assertThatThrownBy(() -> IgdbFranchiseFetcher.parseGroups(
                "{\"title\": \"Syntax Error\", \"status\": 400}"))
                .isInstanceOf(SourceUnavailableException.class);
        assertThatThrownBy(() -> IgdbFranchiseFetcher.parseGames("{\"message\": \"Too Many Requests\"}"))
                .isInstanceOf(SourceUnavailableException.class);
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
