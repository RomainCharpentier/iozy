import { useId, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateOwnershipPlatform } from '@/common/api/ownerships'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { invaliderApresPossession } from '@/common/lib/invalidations'
import type { OwnershipResponse } from '@/common/types/api'

/**
 * The console of a copy of a video game: it decides where the game stands on
 * the shelves. Offers what the source knows, and accepts anything else: a source
 * can miss a console, and a game added by hand has no source at all.
 */
export function ConsoleExemplaire({ exemplaire, consoles }: { exemplaire: OwnershipResponse; consoles: string[] }) {
  const queryClient = useQueryClient()
  const liste = useId()
  const [valeur, setValeur] = useState(exemplaire.platform ?? '')
  const enregistrer = useMutation({
    mutationFn: (console: string) => updateOwnershipPlatform(exemplaire.id, console),
    onSuccess: () => invaliderApresPossession(queryClient),
  })

  const valider = () => {
    if (valeur.trim() !== (exemplaire.platform ?? '')) enregistrer.mutate(valeur.trim())
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        aria-label="Console de cet exemplaire"
        list={liste}
        value={valeur}
        placeholder="À préciser"
        onChange={(evenement) => setValeur(evenement.target.value)}
        onBlur={valider}
        onKeyDown={(evenement) => {
          if (evenement.key === 'Enter') valider()
        }}
        className="min-h-11 w-full rounded-xl border border-fieldBorder bg-surface px-3 text-sm text-textPrimary"
      />
      <datalist id={liste}>
        {consoles.map((console) => (
          <option key={console} value={console} />
        ))}
      </datalist>
      {enregistrer.isError && <ErrorBanner message={enregistrer.error.message} />}
    </div>
  )
}
