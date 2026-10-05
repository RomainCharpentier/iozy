import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importBggCollection } from '@/common/api/metadata'
import { queryKeys } from '@/common/lib/queryKeys'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'

/** Moved from Ma collection (UX audit: a one-off import has no business
 * on the screen consulted at every session, see "fonctionnalités à
 * dépriorioriser" - Import BGG). Same logic, just relocated. */
export function ImportBggPage() {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')

  const importMutation = useMutation({
    mutationFn: importBggCollection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.all })
    },
  })

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/add', libelle: 'Catalogue' }} />

      <EnTeteSection
        niveau={1}
        titre="Importer depuis BoardGameGeek"
        sousTitre="Récupère automatiquement les jeux de société marqués « possédés » sur un compte BoardGameGeek et les ajoute à ta collection — un jeu déjà présent (même titre) n'est jamais dupliqué, juste retrouvé."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (username.trim()) importMutation.mutate(username.trim())
        }}
        className="flex flex-col gap-1.5"
      >
        {/* Visible label rather than a simple placeholder, which does not act
            as one and disappears at the first keystroke - same fix as in
            batch 24 on the two fields of /types/new, this screen not having
            been swept at the time (see batch 29). Pattern taken from SearchPage:
            label above, field and button on the next line. */}
        <label className="text-sm text-textDim" htmlFor="bgg-username">
          Pseudo BoardGameGeek
        </label>
        <div className="flex gap-2">
          <input
            id="bgg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Pseudo BoardGameGeek"
            autoFocus
            className="champ min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={importMutation.isPending || !username.trim()}
            className="btn-primaire shrink-0"
          >
            {importMutation.isPending ? 'Import...' : 'Importer'}
          </button>
        </div>
      </form>

      {importMutation.isError && <ErrorBanner message={importMutation.error.message} />}
      {importMutation.isSuccess && (
        <p className="text-sm text-textDim">
          {importMutation.data.created} créé(s), {importMutation.data.matchedExisting} déjà possédé(s) sur{' '}
          {importMutation.data.totalFound} trouvé(s).
        </p>
      )}
    </div>
  )
}
