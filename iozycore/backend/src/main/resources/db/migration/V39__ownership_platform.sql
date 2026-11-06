-- V39__ownership_platform.sql
-- La console d'un exemplaire : Ma collection range les jeux video par console
-- (lot 203). Elle depend de l'exemplaire et non de l'oeuvre : le catalogue est
-- partage, et un meme jeu peut etre possede sur deux consoles.
-- Vide tant que le proprietaire ne l'a pas dite : jamais devinee.
ALTER TABLE ownership ADD COLUMN platform VARCHAR(100);
