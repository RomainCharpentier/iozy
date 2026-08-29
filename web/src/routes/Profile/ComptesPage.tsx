import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { listerComptes, supprimerCompte, type CompteAdministre } from '../../api/admin'
import { queryKeys } from '../../lib/queryKeys'
import { useAuth } from '../../lib/useAuth'
import { ErrorBanner } from '../../components/ErrorBanner'
import { EnTeteSection } from '../../components/EnTeteSection'
import { CLASSE_CARTE } from '../../components/Carte'

/**
 * Les comptes de l'instance — pour qui en répond.
 *
 * <h2>Ce que cet écran ne montre pas</h2>
 * Aucune donnée de personne. Un pseudo, une adresse, une date, et des
 * <b>nombres</b> : l'isolation par propriétaire est entière, et rien ici ne
 * l'ouvre. Un administrateur répond de la machine, pas des collections qui y
 * vivent.
 *
 * <h2>Pourquoi les nombres sont là, et pas en petit</h2>
 * Ils ne décorent pas : ce sont eux qu'on lit avant de supprimer. « 412
 * possessions » et « aucune donnée » ne se suppriment pas du même geste, et un
 * écran qui montrerait seulement des pseudos ferait prendre la décision à
 * l'aveugle.
 *
 * <h2>La suppression est définitive</h2>
 * Elle emporte possessions, envies, expériences, classements et analyses. Pas
 * de corbeille, pas d'annulation — d'où la confirmation en deux temps, même
 * patron que la suppression d'une fiche, et la phrase qui nomme ce qui part.
 * Le <b>catalogue</b>, lui, est partagé et n'est pas touché.
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
      <EnTeteSection
        niveau={1}
        titre="Comptes"
        sousTitre="Qui a un compte sur cette instance. Chacun a sa propre collection : rien de leur contenu n'apparaît ici."
      />

      {comptesQuery.isError && <ErrorBanner message={comptesQuery.error.message} />}
      {comptesQuery.isLoading && <p className="text-textDim">Chargement...</p>}

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

/** Ce que le compte détruirait, en toutes lettres - « rien » quand c'est rien. */
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
            {/* Se reconnaître dans une liste de comptes évite de chercher
                pourquoi le bouton « Supprimer » manque sur cette ligne-là. */}
            {cestMoi && <span className="text-xs text-textDim">(toi)</span>}
          </span>
          <span className="text-xs text-textDim">{compte.email}</span>
          <span className="text-xs text-faint">
            Inscrit le {creeLe} · {resumeDuVolume(compte)}
          </span>
        </div>

        {/* Aucun bouton sur sa propre ligne : le serveur refuse ce geste (409),
            et proposer une action pour n'annoncer qu'un refus est une porte
            peinte sur un mur. */}
        {!cestMoi && !enConfirmation && (
          <button
            type="button"
            onClick={onDemander}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-danger/35 px-3 py-2 text-[13px] font-medium text-dangerText hover:border-dangerText hover:bg-dangerText hover:text-dangerInk"
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
