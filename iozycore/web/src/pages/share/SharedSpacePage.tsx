import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getSharedSpace } from '@/common/api/share'
import { queryKeys } from '@/common/lib/queryKeys'
import { ApiError } from '@/common/api/client'
import { Squelette } from '@/common/components/Squelette'
import { FondPleinCadre, PleinCadreProvider } from '@/common/components/pleinCadre/PleinCadre'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { EspacePartage } from './EspacePartage'
import { jaquetteDeFond, MESSAGE_LIEN_EXPIRE } from './libelles'

/**
 * The shared space, seen by someone who has no account.
 *
 * **Strictly read-only.** Deliberately outside the private AppShell: no
 * private navigation, no avatar, no deep link to the application. What the
 * page receives is already filtered by the server.
 *
 * <h2>Plein cadre (lot 217)</h2>
 * The page has its own backdrop: the first pinned work ("Mes
 * incontournables"), blurred, lends its colors to the page - else the first
 * cover shown, else the brand tones. The content is {@link EspacePartage}, the
 * same component as the owner's preview.
 *
 * <h2>Three ways a link stops</h2>
 * 404 (unknown or revoked) shows a neutral message, never a detail that would
 * let one guess the link existed. 410 is a gift list past its thirty days:
 * "Ce lien a expiré", so the visitor asks for a new one.
 */
export function SharedSpacePage() {
  return (
    <PleinCadreProvider>
      <FondPleinCadre />
      <Contenu />
    </PleinCadreProvider>
  )
}

function Contenu() {
  const { token } = useParams<{ token: string }>()
  const sharedQuery = useQuery({
    queryKey: queryKeys.sharedSpace(token!),
    queryFn: () => getSharedSpace(token!),
    retry: false,
  })
  const data = sharedQuery.data
  usePleinCadre(jaquetteDeFond(data))

  const statut = sharedQuery.error instanceof ApiError ? sharedQuery.error.status : null
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:px-8">
      {sharedQuery.isLoading && (
        <>
          <h1 className="font-display text-4xl font-bold text-textPrimary">Espace partagé</h1>
          <Squelette lignes={3} />
        </>
      )}
      {sharedQuery.isError && (
        // Without data, a neutral title: announcing "Envies partagées" on a
        // revoked link would suggest it once led somewhere.
        <div className="iozy-verre iozy-verre--fort flex flex-col gap-2 rounded-3xl p-6">
          <h1 className="font-display text-4xl font-bold text-textPrimary">Espace partagé</h1>
          <p className="text-textDim">
            {statut === 404
              ? "Ce lien n'existe pas ou n'est plus actif."
              : statut === 410
                ? `${MESSAGE_LIEN_EXPIRE} Demande un nouveau lien à la personne qui te l’a envoyé.`
                : 'Impossible de charger cette page pour le moment.'}
          </p>
        </div>
      )}
      {data && <EspacePartage data={data} />}
    </div>
  )
}
