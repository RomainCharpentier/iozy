import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, HelpCircle, SkipForward, XCircle } from 'lucide-react'
import { lookupBarcode } from '@/common/api/metadata'
import { quickAdd, searchEntities } from '@/common/api/entities'
import { listEntityTypes } from '@/common/api/entityTypes'
import { queryKeys } from '@/common/lib/queryKeys'
import { CameraBarcodeScanner } from './CameraBarcodeScanner'
import { ScanActionMenu, type ScanCandidate } from './ScanActionMenu'
import { COVER_IMAGE_ATTRIBUTE_KEY } from '@/common/lib/coverImage'
import type { EtatRetour } from '@/common/lib/retour'
import type { MetadataCandidateDto } from '@/common/types/api'
import { TexteCoupe } from '@/common/components/TexteCoupe'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import { ApiError } from '@/common/api/client'
import { invaliderApresPossession } from '@/common/lib/invalidations'

interface ScanEntry {
  code: string
  status: 'added' | 'skipped' | 'not-found' | 'unavailable' | 'error'
  title?: string
  volumeNumber?: number
  edition?: string
  // An active Ownership already references this same Variant (see QuickAddResponse
  // on the backend) - never blocks the add (a 2nd scanned copy stays
  // legitimate, e.g. an accidental duplicate), only warns the user
  // instead of letting them think the volume is brand new for the collection (same
  // signal as formatAddResultMessage in QuickAddPage.tsx, which stayed silent
  // here until now: the result of quickAdd() was not even read).
  alreadyOwned?: boolean
}

/** What a scan row says, in one sentence.
  *
  * Written here rather than as four conditions in the JSX: the text becomes a
  * string, so something we can offer in full when the row is
  * too narrow to show it (see TexteCoupe). */
function libelleEntree(entry: ScanEntry): string {
  const nom = entry.title ?? entry.code
  switch (entry.status) {
    case 'added':
      return nom
    case 'skipped':
      return `${nom} - passé`
    case 'not-found':
      return `Rien trouvé pour ${entry.code}`
    case 'unavailable':
      return `Une source n'a pas répondu pour ${entry.code} - réessaie`
    case 'error':
      return `Échec de la recherche pour ${entry.code}`
  }
}

/** The screen title, defined once: it is rendered in the three
  * states of the page (loading, no Manga type, normal screen) and two
  * copies of the same h1 would end up drifting apart. The back link comes
  * with it, as on the two other import screens (/import-bgg, /import-photo). */
function TitreScan() {
  return (
    <>
      <LienRetour parDefaut={{ to: '/add', libelle: 'Catalogue' }} />
      <EnTeteSection niveau={1} titre="Scan rapide" />
    </>
  )
}

/** "Quick add by scan" (brainstorm) - scans several barcodes in a
  * row with the camera and saves each recognised volume without going through the
  * full Quick add form each time (see CameraBarcodeScanner
  * for the camera/detection mechanics, purely mechanical, no lookup). */
/** A detail page opened from the scan offers to go back to scanning: we scan
  *  a pile of volumes, not just one. */
const RETOUR_SCAN: EtatRetour = { retour: { to: '/scan', libelle: 'Scan' } }

export function ScanPage() {
  const queryClient = useQueryClient()
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })
  const mangaType = entityTypesQuery.data?.find((t) => t.code === 'MANGA')
  const [entries, setEntries] = useState<ScanEntry[]>([])
  const [processing, setProcessing] = useState(false)
  // While a menu is open, the camera keeps running but its
  // detections are ignored (see handleScan): otherwise the next volume
  // would replace the question asked about the previous one.
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
      } catch (erreur) {
        // 503: a metadata database did not answer. Say so, rather than
        // confusing it with a failed search - the useful action is not
        // the same (retry, versus search by title).
        const indisponible = erreur instanceof ApiError && erreur.status === 503
        setEntries((prev) => [{ code, status: indisponible ? 'unavailable' : 'error' }, ...prev])
        return
      }
      if (!candidate) {
        setEntries((prev) => [{ code, status: 'not-found' }, ...prev])
        return
      }

      // The backend reads the book title ("One Piece - Édition originale Tome 01"):
      // candidate.title is the series, the volume comes apart. Reading the number
      // here again from the series title would find nothing. A volume without a
      // detected number is still added to its series, without a "Tome N" Variant.
      const volumeNumber = candidate.volume?.number ?? undefined
      // The edition named in the book title comes first ("Édition originale").
      // Otherwise, same fallback as QuickAddPage.pickCandidate: the publisher returned by the
      // candidate (Google Books/Open Library on an ISBN scan) serves as the
      // best available edition guess - never filled in for
      // Jikan/MyAnimeList, which do not know French publishers. Without this
      // fallback, a scanned volume kept an empty edition and escaped the
      // detection of mixed editions and the completion suggestions, which
      // both group volumes by this attribute.
      const edition =
        candidate.volume?.edition ??
        (typeof candidate.attributes.publisher === 'string' ? candidate.attributes.publisher : undefined)
      // Local search, free: used to offer "open the detail page" when
      // the work already has one, rather than leaving the add as the only
      // way out. Finding a page says nothing about ownership.
      let existingEntity = null
      try {
        const matches = await searchEntities({ q: candidate.title, entityTypeId: mangaType.id })
        existingEntity = matches[0] ?? null
      } catch {
        existingEntity = null
      }

      // No write here anymore: the scan IDENTIFIES, the user decides.
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
        // Scanning and adding takes one click: the condition is no longer asked
        // in advance (user decision of 2026-08-27), it is fixed on
        // the copy from the detail page (see OwnershipDetails).
        condition: 'NEW',
        attributes,
        volumeNumber,
        edition,
      })
      invaliderApresPossession(queryClient)
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

  // The title stays in both dead ends below. A page that replaces
  // ALL its content with a line of text loses its h1 - so the title of its
  // tab, which useDocumentTitle reads from it, and its only structure marker
  // for a screen reader.
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

      <CameraBarcodeScanner onScan={handleScan} />

      {/* Manual entry of the code: the fallback shown by CameraBarcodeScanner
              when BarcodeDetector is missing (Safari, Firefox, a computer with no camera)
              pointed to "the manual barcode search below",
              which existed on none of these screens - so this page was a complete
              dead end on these browsers. It goes through exactly the
              same path as the camera, context menu included. */}
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
            className="champ min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || processing || !!pending}
            className="btn-secondaire shrink-0"
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
          // The preview of the scanned work: nothing is written until a volume
          // is ticked (see ApercuOeuvrePage).
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
              {entry.status === 'unavailable' && <HelpCircle size={16} className="shrink-0 text-warning" />}
              {entry.status === 'error' && <XCircle size={16} className="shrink-0 text-danger" />}
              {/* Two lines rather than one cut off: "Une source n'a pas répondu…"
                      lost its end behind "Chercher par titre" on 390 px. */}
              <TexteCoupe texte={libelleEntree(entry)} className="line-clamp-2 min-w-0 flex-1 text-textPrimary" />
              {entry.volumeNumber !== undefined && (
                <span className="shrink-0 text-xs text-textDim">
                  Tome {entry.volumeNumber}
                  {entry.edition && ` · ${entry.edition}`}
                </span>
              )}
              {/* A scan with no result is not necessarily an absence: the
                      provider may simply not have answered (seen live, the same barcode served then refused
                      a few seconds apart). Hence "Rien trouvé" rather than "Aucune
                      correspondance", and a way out rather than a dead
                      line. */}
              {(entry.status === 'not-found' || entry.status === 'unavailable' || entry.status === 'error') && (
                <button
                  type="button"
                  onClick={() => navigate('/add')}
                  className="flex min-h-11 shrink-0 items-center text-xs text-textDim underline hover:text-textPrimary"
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
