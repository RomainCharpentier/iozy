import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { listerComptes, supprimerCompte, type CompteAdministre } from '@/common/api/admin'
import { queryKeys } from '@/common/lib/queryKeys'
import { useAuth } from '@/common/hooks/useAuth'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { LienRetour } from '@/common/components/LienRetour'
import { Squelette } from '@/common/components/Squelette'

/**
 * The accounts of the instance - for whoever answers for them.
 *
 * <h2>What this screen does not show</h2>
 * No data of any person. A username, an address, a date, and
 * <b>numbers</b>: the isolation by owner is complete, and nothing here
 * opens it. An administrator answers for the machine, not for the collections that
 * live on it.
 *
 * <h2>Why the numbers are there, and not small</h2>
 * They do not decorate: they are what one reads before deleting. "412
 * possessions" and "aucune donnée" are not deleted with the same gesture, and a
 * screen that only showed usernames would make the decision
 * blindly.
 *
 * <h2>The deletion is final</h2>
 * It takes away ownerships, wishes, experiences, rankings and analyses. No
 * trash, no undo - hence the two-step confirmation, same
 * pattern as the deletion of a work page, and the sentence that names what goes away.
 * The <b>catalog</b>, for its part, is shared and is not touched.
 */
export function ComptesPage() {
  const { compte: moi } = useAuth()
  const queryClient = useQueryClient()
  const [aSupprimer, setASupprimer] = useState<string | null>(null)

  const comptesQuery = useQuery({ queryKey: queryKeys.admin.comptes, queryFn: listerComptes })

  const suppression = useMutation({
    mutationFn: supprimerCompte,
    onSuccess: () => {
      setASupprimer(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.comptes })
    },
  })

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/administration', libelle: 'Administration' }} />

      <EnTeteSection
        niveau={1}
        titre="Comptes"
        sousTitre="Qui a un compte sur cette instance. Chacun a sa propre collection : rien de leur contenu n'apparaît ici."
      />

      {comptesQuery.isError && <ErrorBanner message={comptesQuery.error.message} />}
      {comptesQuery.isLoading && <Squelette lignes={3} />}

      <ul className="flex flex-col gap-2">
        {(comptesQuery.data ?? []).map((compte) => (
          <li key={compte.id} className={CLASSE_CARTE}>
            <LigneCompte
              compte={compte}
              cestMoi={compte.id === moi?.id}
              enConfirmation={aSupprimer === compte.id}
              onDemander={() => setASupprimer(compte.id)}
              onAnnuler={() => setASupprimer(null)}
              onConfirmer={() => suppression.mutate(compte.id)}
              enCours={suppression.isPending}
            />
            {aSupprimer === compte.id && suppression.isError && (
              <ErrorBanner message={suppression.error.message} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** What the account would destroy, in full words - "rien" when it is nothing. */
function resumeDuVolume(compte: CompteAdministre): string {
  if (compte.volume.total === 0) return 'Aucune donnée'
  const morceaux = [
    [compte.volume.possessions, 'possession', 'possessions'],
    [compte.volume.envies, 'envie', 'envies'],
    [compte.volume.experiences, 'expérience', 'expériences'],
    [compte.volume.classements, 'classement', 'classements'],
    [compte.volume.analyses, 'analyse', 'analyses'],
  ] as const
  return morceaux
    .filter(([combien]) => combien > 0)
    .map(([combien, singulier, pluriel]) => `${combien} ${combien > 1 ? pluriel : singulier}`)
    .join(' · ')
}

function LigneCompte({
  compte,
  cestMoi,
  enConfirmation,
  onDemander,
  onAnnuler,
  onConfirmer,
  enCours,
}: {
  compte: CompteAdministre
  cestMoi: boolean
  enConfirmation: boolean
  onDemander: () => void
  onAnnuler: () => void
  onConfirmer: () => void
  enCours: boolean
}) {
  const creeLe = new Date(compte.creeLe).toLocaleDateString('fr-FR')

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-textPrimary">{compte.pseudo}</span>
            {compte.admin && (
              <span className="rounded-full bg-accentTint px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-accentText uppercase">
                Administrateur
              </span>
            )}
            {/* Recognizing oneself in a list of accounts avoids looking for
                why the "Supprimer" button is missing on that row. */}
            {cestMoi && <span className="text-xs text-textDim">(toi)</span>}
          </span>
          <span className="text-xs text-textDim">{compte.email}</span>
          <span className="text-xs text-faint">
            Inscrit le {creeLe} · {resumeDuVolume(compte)}
          </span>
        </div>

        {/* No button on one's own row: the server refuses this gesture (409),
            and offering an action only to announce a refusal is a door
            painted on a wall. */}
        {!cestMoi && !enConfirmation && (
          <button
            type="button"
            onClick={onDemander}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-danger/35 px-3 text-[13px] font-medium text-dangerText hover:border-dangerText hover:bg-dangerText hover:text-dangerInk"
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        )}
      </div>

      {enConfirmation && (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-dangerText">
            Supprimer définitivement le compte « {compte.pseudo} » et tout ce qu'il contient
            {compte.volume.total > 0 ? ` (${resumeDuVolume(compte).toLowerCase()})` : ''} ? Les œuvres du catalogue
            restent, elles sont partagées. Cette action est irréversible.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onConfirmer}
              disabled={enCours}
              className="rounded-xl bg-danger px-3.5 py-2.5 text-[13px] font-semibold text-dangerInk disabled:opacity-50"
            >
              {enCours ? 'Suppression...' : 'Confirmer la suppression'}
            </button>
            <button type="button" onClick={onAnnuler} className="rounded-xl px-3.5 py-2.5 text-[13px] text-textDim">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
