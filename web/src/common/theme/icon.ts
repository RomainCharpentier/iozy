import { Tag, Layers, Package, Folder, Bookmark, Box, Grid3x3, Puzzle, Archive } from 'lucide-react'
import { djb2Hash } from './gradient'

/** Generic icons for a type created by the user (no curation
 * possible as for the 3 historical MVP types) - same principle as
 * gradientFor(): deterministic hash of the code into a small fixed list. */
const iconFallbacks = [Tag, Layers, Package, Folder, Bookmark, Box, Grid3x3, Puzzle, Archive]

export function iconFor(code: string) {
  return iconFallbacks[djb2Hash(code) % iconFallbacks.length]
}
