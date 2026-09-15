package com.iozycore.manga.recognition;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RecognizedBoxTest {

    @Test
    void gemini_thousandths_become_fractions_of_the_photo() {
        RecognizedBox boite = RecognizedBox.fromThousandths(2, 100, 250, 900, 320).orElseThrow();

        assertThat(boite.imageIndex()).isEqualTo(2);
        assertThat(boite.top()).isEqualTo(0.1);
        assertThat(boite.left()).isEqualTo(0.25);
        assertThat(boite.bottom()).isEqualTo(0.9);
        assertThat(boite.right()).isEqualTo(0.32);
    }

    @Test
    void a_box_that_spills_over_the_edge_is_brought_back_inside() {
        RecognizedBox boite = RecognizedBox.fromThousandths(0, -20, 980, 1040, 1200).orElseThrow();

        assertThat(boite.top()).isZero();
        assertThat(boite.left()).isEqualTo(0.98);
        assertThat(boite.bottom()).isEqualTo(1.0);
        assertThat(boite.right()).isEqualTo(1.0);
    }

    @Test
    void a_box_without_surface_or_on_a_negative_photo_is_no_box() {
        assertThat(RecognizedBox.fromThousandths(0, 500, 200, 500, 300)).isEmpty();
        assertThat(RecognizedBox.fromThousandths(0, 100, 300, 900, 300)).isEmpty();
        assertThat(RecognizedBox.fromThousandths(0, 900, 100, 100, 300)).isEmpty();
        assertThat(RecognizedBox.fromThousandths(-1, 100, 100, 900, 300)).isEmpty();
    }

    @Test
    void the_record_itself_refuses_an_inverted_or_out_of_photo_rectangle() {
        assertThatThrownBy(() -> new RecognizedBox(0, 0.9, 0.1, 0.1, 0.3)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RecognizedBox(0, 0.1, 0.1, 1.2, 0.3)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RecognizedBox(-1, 0.1, 0.1, 0.9, 0.3)).isInstanceOf(IllegalArgumentException.class);
    }
}
