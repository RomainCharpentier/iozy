import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, HelpCircle, SkipForward, XCircle } from 'lucide-react'
import { lookupBarcode } from '../../api/metadata'
import { quickAdd, searchEntities } from '../../api/entities'
import { listEntityTypes } from '../../api/entityTypes'
import { queryKeys } from '../../lib/queryKeys'
import { Chip } from '../../components/Chip'
import { CONDITIONS, CONDITION_LABELS, type Condition } from '../../types/entityTypes'
import { CameraBarcodeScanner } from './CameraBarcodeScanner'
import { ScanActionMenu, type ScanCandidate } from './ScanActionMenu'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '../../lib/coverImage'
import type { EtatFiche } from '../EntityDetail/retourFiche'
import type { MetadataCandidateDto } from '../../types/api'
import { TexteCoupe } from '../../components/TexteCoupe'
import { EnTeteSection } from '../../components/EnTeteSection'

interface ScanEntry {
  code: string
  status: 'added' | 'skipped' | 'not-found' | 'error'
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

/** Ce qu'une ligne de scan raconte, en une phrase.
 *
 * Écrit ici plutôt qu'en quatre conditions dans le JSX : le texte devient une
 * chaîne, donc quelque chose qu'on peut proposer en entier quand la ligne est
 * trop étroite pour l'afficher (voir TexteCoupe). */
function libelleEntree(entry: ScanEntry): string {
  const nom = entry.title ?? entry.code
  switch (entry.status) {
    case 'added':
      return nom
    case 'skipped':
      return `${nom} - passé`
    case 'not-found':
      return `Rien trouvé pour ${entry.code}`
    case 'error':
      return `Échec de la recherche pour ${entry.code}`
  }
}

/** Le titre de l'écran, défini une seule fois : il est rendu dans les trois
 * états de la page (chargement, pas de type Manga, écran normal) et deux
 * copies du même h1 finiraient par diverger. */
function TitreScan() {
  return <EnTeteSection niveau={1} titre="Scan rapide" />
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
/** Une fiche ouverte depuis le scan propose de revenir scanner : on scanne
 *  une pile de tomes, pas un seul. */
const RETOUR_SCAN: EtatFiche = { retour: { to: '/scan', libelle: 'Scan' } }

export function ScanPage() {
  const queryClient = useQueryClient()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const mangaType = entityTypesQuery.data?.find((t) => t.code === 'MANGA')
  const [condition, setCondition] = useState<Condition>('NEW')
  const [entries, setEntries] = useState<ScanEntry[]>([])
  const [processing, setProcessing] = useState(false)
  // Tant qu'un menu est ouvert, la caméra continue de tourner mais ses
  // détections sont ignorées (voir handleScan) : sinon le tome suivant
  // remplacerait la question posée sur le précédent.
  const [pending, setPending] = useState<ScanCandidate | null>(null)
  const [adding, setAdding] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const navigate = useNavigate()

  async function handleScan(code: string) {
    if (!mangaType || processing || pending) return
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
      // Recherche locale, gratuite : sert à proposer "ouvrir la fiche" quand
      // l'œuvre a déjà la sienne, plutôt que de laisser l'ajout comme seule
      // issue. Trouver une fiche ne dit rien de la possession.
      let existingEntity = null
      try {
        const matches = await searchEntities({ q: candidate.title, entityTypeId: mangaType.id })
        existingEntity = matches[0] ?? null
      } catch {
        existingEntity = null
      }

      // Plus aucune écriture ici : le scan IDENTIFIE, l'utilisateur décide.
      setPending({ code, candidate, entityTypeId: mangaType.id, volumeNumber, edition, existingEntity })
    } finally {
      setProcessing(false)
    }
  }

  async function addPending() {
    if (!pending || !mangaType) return
    setAdding(true)
    try {
      const { candidate, volumeNumber, edition, code } = pending
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
      queryClient.invalidateQueries({ queryKey: queryKeys.allOwnerships })
      setEntries((prev) => [
        { code, status: 'added', title: candidate.title, volumeNumber, edition, alreadyOwned: result.matchedExistingVariant },
        ...prev,
      ])
      setPending(null)
    } finally {
      setAdding(false)
    }
  }

  function skipPending() {
    if (!pending) return
    setEntries((prev) => [
      { code: pending.code, status: 'skipped', title: pending.candidate.title },
      ...prev,
    ])
    setPending(null)
  }

  // Le titre reste dans les deux impasses ci-dessous. Une page qui remplace
  // TOUT son contenu par une ligne de texte perd son h1 - donc le titre de son
  // onglet, que useDocumentTitle lit dessus, et son seul repère de structure
  // pour un lecteur d'écran.
  if (entityTypesQuery.isLoading || !mangaType) {
    return (
      <div className="flex flex-col gap-4">
        <TitreScan />
        <p className="text-textDim">
          {entityTypesQuery.isLoading
            ? 'Chargement...'
            : 'Aucun type "Manga" configuré - le scan par code-barres n\'a de sens que pour des mangas.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <TitreScan />
      <p className="text-sm text-textDim">
        Pointe la caméra sur le code-barres de chaque tome, à la suite. Chaque tome reconnu ouvre un menu qui te
        demande quoi en faire - rien n'est enregistré sans toi. Le numéro de tome est déduit du titre quand c'est
        possible ; quand il ne l'est pas, « Choisir l'édition et les tomes » est là pour ça.
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-textDim">État (appliqué quand tu choisis « Ajouter à ma collection »)</span>
        <div className="flex gap-2">
          {CONDITIONS.map((c) => (
            <Chip key={c} label={CONDITION_LABELS[c]} isActive={condition === c} onClick={() => setCondition(c)} />
          ))}
        </div>
      </div>

      <CameraBarcodeScanner onScan={handleScan} />

      {/* Saisie manuelle du code : le repli affiché par CameraBarcodeScanner
          quand BarcodeDetector est absent (Safari, Firefox, poste sans caméra)
          renvoyait vers "la recherche par code-barres manuelle ci-dessous",
          qui n'existait sur aucun de ces écrans - cette page était donc une
          impasse complète sur ces navigateurs. Elle passe par exactement le
          même chemin que la caméra, menu contextuel compris. */}
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          const code = manualCode.trim()
          if (!code) return
          setManualCode('')
          void handleScan(code)
        }}
      >
        <label className="text-sm text-textDim" htmlFor="manual-barcode">
          Ou saisis le code-barres (ISBN)
        </label>
        <div className="flex gap-2">
          <input
            id="manual-barcode"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="9782505..."
            inputMode="numeric"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || processing || !!pending}
            className="flex min-h-11 shrink-0 items-center rounded-lg bg-surface2 px-4 text-sm font-semibold text-textPrimary disabled:opacity-50"
          >
            {processing ? 'Recherche...' : 'Chercher'}
          </button>
        </div>
      </form>

      {pending && (
        <ScanActionMenu
          pending={pending}
          busy={adding}
          onAdd={addPending}
          onSkip={skipPending}
          // L'aperçu de l'œuvre scannée : rien n'est écrit tant qu'un tome
          // n'est pas coché (voir ApercuOeuvrePage).
          onOpenDraft={() =>
            navigate(
              `/apercu?type=${encodeURIComponent(mangaType.id)}&titre=${encodeURIComponent(pending.candidate.title)}`,
            )
          }
          onOpenEntity={(entityId) => navigate(`/entity/${entityId}`, { state: RETOUR_SCAN })}
        />
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry, index) => (
            <li key={index} className="flex items-center gap-2 rounded-lg bg-surface p-2.5 text-sm">
              {entry.status === 'added' && (
                <CheckCircle2 size={16} className={`shrink-0 ${entry.alreadyOwned ? 'text-textDim' : 'text-accentText'}`} />
              )}
              {entry.status === 'skipped' && <SkipForward size={16} className="shrink-0 text-textDim" />}
              {entry.status === 'not-found' && <HelpCircle size={16} className="shrink-0 text-textDim" />}
              {entry.status === 'error' && <XCircle size={16} className="shrink-0 text-danger" />}
              <TexteCoupe texte={libelleEntree(entry)} className="min-w-0 flex-1 truncate text-textPrimary" />
              {entry.volumeNumber !== undefined && (
                <span className="shrink-0 text-xs text-textDim">
                  Tome {entry.volumeNumber}
                  {entry.edition && ` · ${entry.edition}`}
                </span>
              )}
              {/* Un scan sans résultat n'est pas forcément une absence : le
                  fournisseur peut simplement n'avoir pas répondu (constaté en
                  direct, même code-barres servi puis refusé à quelques secondes
                  d'intervalle). D'où "Rien trouvé" plutôt qu'"Aucune
                  correspondance", et une porte de sortie plutôt qu'une ligne
                  morte. */}
              {(entry.status === 'not-found' || entry.status === 'error') && (
                <button
                  type="button"
                  onClick={() => navigate('/add')}
                  className="shrink-0 text-xs text-textDim underline hover:text-textPrimary"
                >
                  Chercher par titre
                </button>
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
