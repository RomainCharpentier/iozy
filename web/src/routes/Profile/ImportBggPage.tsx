import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { importBggCollection } from '../../api/metadata'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'

/** Déplacé depuis Ma collection (audit UX : un import ponctuel n'a rien à
 * faire sur l'écran consulté à chaque session, voir "fonctionnalités à
 * dépriorioriser" - Import BGG). Logique identique, juste relocalisée. */
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
      <h1 className="font-display text-2xl font-bold text-textPrimary">Importer depuis BoardGameGeek</h1>
      <p className="text-sm text-textDim">
        Récupère automatiquement les jeux de société marqués « possédés » sur un compte BoardGameGeek et les ajoute
        à ta collection - un jeu déjà présent (même titre) n'est jamais dupliqué, juste retrouvé.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (username.trim()) importMutation.mutate(username.trim())
        }}
        className="flex gap-2"
      >
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Pseudo BoardGameGeek"
          autoFocus
          className="flex-1 rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <button
          type="submit"
          disabled={importMutation.isPending || !username.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accentInk disabled:opacity-50"
        >
          {importMutation.isPending ? 'Import...' : 'Importer'}
        </button>
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
