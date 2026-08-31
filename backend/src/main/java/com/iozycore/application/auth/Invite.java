package com.iozycore.application.auth;

/**
 * Un visiteur sans compte : quelqu'un qui consulte le <b>catalogue</b>, et
 * rien d'autre.
 *
 * <h2>Il ne porte AUCUN propriétaire, et c'est tout le sujet</h2>
 * Une première version le faisait entrer « chez » quelqu'un : il portait
 * l'identifiant d'une collection, et lisait les possessions, les notes et les
 * classements de cette personne. Ce n'était pas ce qu'on voulait montrer. Un
 * visiteur doit voir les <b>œuvres</b> que l'instance connaît - titre,
 * jaquette, éditions - et rien de ce que quelqu'un en a fait.
 *
 * <p>Or le cloisonnement rend déjà exactement cela à qui n'est personne :
 * le catalogue est <b>partagé</b> (aucune colonne de propriétaire, voir
 * {@code ProprietaireCourant}), tandis que possessions, envies, expériences et
 * classements sont filtrés par propriétaire. Un principal qui ne nomme aucun
 * propriétaire retombe sur {@link com.iozycore.domain.shared.DefaultOwner#PERSONNE},
 * <b>à qui rien n'appartient</b> - donc le catalogue entier, et pas une ligne
 * de données personnelles.
 *
 * <p>C'est pour cette raison que cet enregistrement est <b>vide</b>. Ce n'est
 * pas un oubli : lui donner un champ « propriétaire » serait rouvrir la porte
 * qu'on vient de fermer, et il faudrait alors se demander à chaque écran ce
 * qu'il a le droit d'en lire. Il ne le porte pas, donc la question ne se pose
 * plus nulle part.
 *
 * <h2>Ce qu'il sert encore à dire</h2>
 * Deux choses, et elles suffisent : que la session est <b>authentifiée</b>
 * (sans quoi le cloisonnement ne la laisserait rien lire du tout) et qu'elle
 * est en <b>lecture seule</b> (voir {@code SecurityConfig}). Le type lui-même
 * porte l'information ; il n'a pas besoin de données.
 */
public record Invite() {
}
