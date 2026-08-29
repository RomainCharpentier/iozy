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
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(cleanup)
