import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { lookupBarcode } from '../../api/metadata'
import { quickAdd } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { Chip } from '../../components/Chip'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'
import { CameraBarcodeScanner } from './CameraBarcodeScanner'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import type { MetadataCandidateDto } from '../../types/api'

interface ScanEntry {
  code: string
  status: 'added' | 'not-found' | 'error'
  title?: string
  volumeNumber?: number
  edition?: string
  // Une Ownership active référence déjà ce même Variant (voir QuickAddResponse
  // côté backend) - ne bloque jamais l'ajout (un 2e exemplaire scanné reste
  // légitime, ex: un doublon accidentel), sert seulement à avertir l'utilisateur
  // au lieu de laisser croire à un tome tout neuf pour la collection (même
  // signal que formatAddResultMessage dans QuickAddPage.tsx, resté silencieux
  // ici jusqu'ici : le résultat de quickAdd() n'était même pas lu).
  alreadyOwned?: boolean
}

/** Best-effort, jamais autoritaire : le lookup par code-barres (voir
 * BarcodeLookupField) ne renvoie pas de volumeNumber structuré - les
 * providers ISBN (Google Books/Open Library) mettent parfois "Tome N" ou
 * "T. N" dans le titre lui-même, sans garantie de présence ni de format.
 * Un tome ajouté sans numéro détecté reste ajouté quand même (rattaché à
 * la série), juste sans Variant "Tome N" dédié - à corriger à la main
 * depuis la fiche ensuite si besoin (voir AddVolumeSection). */
function parseVolumeNumberFromTitle(title: string): number | undefined {
  const match = title.match(/\bt(?:ome)?\.?\s*(\d+)\b/i)
  return match ? Number(match[1]) : undefined
}

/** "Ajout rapide par scan" (brainstorm) - scanne plusieurs codes-barres à la
 * suite via la caméra et enregistre chaque tome reconnu sans repasser par le
 * formulaire complet d'Ajout rapide à chaque fois (voir CameraBarcodeScanner
 * pour la mécanique caméra/détection, purement mécanique, aucun lookup). */
export function ScanPage() {
  const queryClient = useQueryClient()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const mangaType = entityTypesQuery.data?.find((t) => t.code === 'MANGA')
  const [condition, setCondition] = useState<Condition>('NEW')
  const [entries, setEntries] = useState<ScanEntry[]>([])
  const [processing, setProcessing] = useState(false)

  async function handleScan(code: string) {
    if (!mangaType || processing) return
    setProcessing(true)
    try {
      let candidate: MetadataCandidateDto | null = null
      try {
        candidate = await lookupBarcode(mangaType.id, code)
      } catch {
        setEntries((prev) => [{ code, status: 'error' }, ...prev])
        return
      }
      if (!candidate) {
        setEntries((prev) => [{ code, status: 'not-found' }, ...prev])
        return
      }

      const volumeNumber = parseVolumeNumberFromTitle(candidate.title)
      // Même repli que QuickAddPage.pickCandidate : l'éditeur renvoyé par le
      // candidat (Google Books/Open Library sur un scan ISBN) sert de
      // meilleure estimation d'édition disponible - jamais renseigné pour
      // Jikan/MyAnimeList, qui ne connaissent pas d'éditeur français. Sans ce
      // repli, un tome scanné restait avec une édition vide et échappait à la
      // détection d'éditions mélangées / aux suggestions de complétion, qui
      // regroupent toutes deux les tomes par cet attribut.
      const edition = typeof candidate.attributes.publisher === 'string' ? candidate.attributes.publisher : undefined
      const attributes = candidate.imageUrl
        ? { ...candidate.attributes, [COVER_IMAGE_ATTRIBUTE_KEY]: candidate.imageUrl }
        : candidate.attributes

      const result = await quickAdd({
        entityTypeId: mangaType.id,
        title: candidate.title,
        condition,
        attributes,
        volumeNumber,
        edition,
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
      setEntries((prev) => [
        { code, status: 'added', title: candidate!.title, volumeNumber, edition, alreadyOwned: result.matchedExistingVariant },
        ...prev,
      ])
    } finally {
      setProcessing(false)
    }
  }

  if (entityTypesQuery.isLoading) return <p className="text-textDim">Chargement...</p>

  if (!mangaType) {
    return <p className="text-textDim">Aucun type "Manga" configuré - le scan par code-barres n'a de sens que pour des mangas.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold text-textPrimary">Scan rapide</h1>
      <p className="text-sm text-textDim">
        Pointe la caméra sur le code-barres de chaque tome, à la suite - chaque tome reconnu est ajouté directement,
        sans repasser par le formulaire. Le numéro de tome est déduit du titre quand c'est possible, sinon le tome est
        ajouté rattaché à la série seule (à préciser ensuite depuis sa fiche si besoin).
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-textDim">État (appliqué à chaque tome ajouté)</span>
        <div className="flex gap-2">
          {CONDITIONS.map((c) => (
            <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => setCondition(c)} />
          ))}
        </div>
      </div>

      <CameraBarcodeScanner onScan={handleScan} />

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry, index) => (
            <li key={index} className="flex items-center gap-2 rounded-lg bg-surface p-2.5 text-sm">
              {entry.status === 'added' && (
                <CheckCircle2 size={16} className={`shrink-0 ${entry.alreadyOwned ? 'text-textDim' : 'text-accent'}`} />
              )}
              {entry.status === 'not-found' && <HelpCircle size={16} className="shrink-0 text-textDim" />}
              {entry.status === 'error' && <XCircle size={16} className="shrink-0 text-danger" />}
              <span className="min-w-0 flex-1 truncate text-textPrimary">
                {entry.status === 'added' && (entry.title ?? entry.code)}
                {entry.status === 'not-found' && `Aucune correspondance pour ${entry.code}`}
                {entry.status === 'error' && `Échec de la recherche pour ${entry.code}`}
              </span>
              {entry.volumeNumber !== undefined && (
                <span className="shrink-0 text-xs text-textDim">
                  Tome {entry.volumeNumber}
                  {entry.edition && ` · ${entry.edition}`}
                </span>
              )}
              {entry.alreadyOwned && (
                <span
                  className="shrink-0 text-xs text-textDim"
                  title="Une Ownership active référence déjà ce tome - exemplaire ajouté quand même"
                >
                  · déjà possédé
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
