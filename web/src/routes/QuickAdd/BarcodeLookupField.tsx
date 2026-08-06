import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ScanBarcode } from 'lucide-react'
import { lookupBarcode } from '../../api/metadata'
import type { MetadataCandidateDto } from '../../types/api'

interface BarcodeLookupFieldProps {
  entityTypeId: string
  onFound: (candidate: MetadataCandidateDto) => void
}

/**
 * Pas de scan caméra en v1 (usage desktop) - saisie manuelle du code-barres/
 * ISBN à la place, qui appelle quand même le lookup backend (mangas
 * uniquement, comme côté iOS : Open Library ne couvre que l'ISBN livre).
 * Un 404 (pas de correspondance) n'est pas une erreur, juste "rien trouvé".
 */
export function BarcodeLookupField({ entityTypeId, onFound }: BarcodeLookupFieldProps) {
  const [barcode, setBarcode] = useState('')
  const [notFound, setNotFound] = useState(false)

  const mutation = useMutation({
    mutationFn: () => lookupBarcode(entityTypeId, barcode.trim()),
    onSuccess: (candidate) => {
      setNotFound(candidate === null)
      if (candidate) onFound(candidate)
    },
  })

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-textDim" htmlFor="barcode">
        Code-barres / ISBN (mangas uniquement)
      </label>
      <div className="flex gap-2">
        <input
          id="barcode"
          value={barcode}
          onChange={(e) => {
            setBarcode(e.target.value)
            setNotFound(false)
          }}
          placeholder="ex: 9782723492607"
          className="flex-1 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none"
        />
        <button
          type="button"
          onClick={() => barcode.trim() && mutation.mutate()}
          disabled={!barcode.trim() || mutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary disabled:opacity-50"
        >
          <ScanBarcode size={16} />
          {mutation.isPending ? 'Recherche...' : 'Rechercher'}
        </button>
      </div>
      {notFound && <p className="text-xs text-textDim">Aucune correspondance trouvée pour ce code.</p>}
    </div>
  )
}
