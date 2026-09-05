import { Tag, Layers, Package, Folder, Bookmark, Box, Grid3x3, Puzzle, Archive } from 'lucide-react'
import { djb2Hash } from './gradient'

/** Icônes génériques pour un type créé par l'utilisateur (pas de curation
 * possible comme pour les 3 types MVP historiques) - même principe que
 * gradientFor() : hash déterministe du code vers une petite liste fixe. */
const iconFallbacks = [Tag, Layers, Package, Folder, Bookmark, Box, Grid3x3, Puzzle, Archive]

export function iconFor(code: string) {
  return iconFallbacks[djb2Hash(code) % iconFallbacks.length]
}
