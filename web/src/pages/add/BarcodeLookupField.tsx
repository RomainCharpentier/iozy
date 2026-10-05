import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, ScanBarcode } from 'lucide-react'
import { lookupBarcode } from '@/common/api/metadata'
import type { MetadataCandidateDto } from '@/common/types/api'

interface BarcodeLookupFieldProps {
  entityTypeId: string
  onFound: (candidate: MetadataCandidateDto) => void
}

/**
  * No camera scan in v1 (desktop use) - manual entry of the barcode/
  * ISBN instead, which still calls the backend lookup (manga
  * only, as on iOS: Open Library only covers the book ISBN).
  * A 404 (no match) is not an error, just "nothing found".
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
          className="champ flex-1"
        />
        <button
          type="button"
          onClick={() => barcode.trim() && mutation.mutate()}
          disabled={!barcode.trim() || mutation.isPending}
          className="btn-secondaire"
        >
          {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ScanBarcode size={16} />}
          {mutation.isPending ? 'Recherche...' : 'Rechercher'}
        </button>
      </div>
      {notFound && <p className="text-xs text-textDim">Aucune correspondance trouvée pour ce code.</p>}
    </div>
  )
}
