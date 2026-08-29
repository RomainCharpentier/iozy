/**
 * Ce que chaque test web trouve déjà en place.
 *
 * Deux choses seulement, et aucune n'est un raccourci d'écriture :
 * les matchers DOM de jest-dom (`toBeInTheDocument`, `toHaveTextContent`…),
 * qui disent ce qu'ils vérifient bien mieux qu'une assertion sur un nœud ;
 * et le démontage systématique du rendu précédent, sans quoi deux tests d'un
 * même fichier chercheraient leur texte dans le DOM cumulé des deux.
 *
 * Le `localStorage` est celui de jsdom : réel, et partagé par tous les tests
 * d'un même fichier. Un test qui écrit dedans (préférences, langue des titres)
 * le remet à zéro lui-même - le déclarer ici cacherait la dépendance.
 *
 * <h2>ResizeObserver, faute de mise en page</h2>
 * jsdom ne l'implémente pas, et tout écran qui affiche un titre passe par
 * `TexteCoupe`, qui s'en sert pour savoir si le texte déborde. Sans ce
 * bouchon, le rendu échoue avant la première assertion - pour une raison qui
 * n'a rien à voir avec ce qu'on teste.
 *
 * <p>Il ne notifie jamais : jsdom ne fait aucune mise en page, donc aucune
 * taille ne change réellement. Un bouchon qui déclencherait un rappel
 * inventerait une mesure, et `TexteCoupe` conclurait au hasard. Ce qu'un test
 * peut affirmer ici, c'est le TEXTE ; ce qu'il ne peut pas, c'est sa
 * troncature (voir aussi le navigateur de test, dont le viewport vaut 0).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

afterEach(cleanup)
