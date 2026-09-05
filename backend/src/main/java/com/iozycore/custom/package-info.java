/**
 * Les types de collection définis DANS iozycore - le quatrième univers, celui
 * qui n'a aucun fournisseur (Lot 133).
 *
 * <p>Mangas, jeux vidéo et jeux de société ont chacun leur module et leurs
 * sources. Tout autre type (figurines, vinyles, ce que l'utilisateur veut
 * collectionner) est créé ici, avec ses champs personnalisés ; ses fiches se
 * saisissent à la main et se retrouvent par la seule base iozycore. Le cœur
 * ne fait aucune différence : une œuvre d'un type personnalisé est une œuvre
 * comme les autres, sans point d'extension à implémenter - c'est précisément
 * ce qui permet d'ajouter un type sans écrire de code.
 */
@org.springframework.modulith.ApplicationModule(displayName = "Types personnalisés")
package com.iozycore.custom;
