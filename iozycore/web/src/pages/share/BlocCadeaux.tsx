import { Gift, RefreshCw, Trash2 } from 'lucide-react'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import type { GiftLinkDto } from '@/common/types/share'
import { ActionEnDeuxTemps, BoutonCopier } from './Commandes'
import { adresseDuLien } from './usePartage'
import { etatListe } from './libelles'

/**
 * The gift list (lot 217): a second link that shows the wishes only, and
 * stops after thirty days. "Prolonger" gives thirty days from now and keeps
 * the address, so a list already sent works again. The share link above is
 * a separate one and does not expire.
 */
export function BlocCadeaux({
  lien,
  onCreerOuProlonger,
  onSupprimer,
  enCours,
  erreur,
}: {
  lien: GiftLinkDto | null
  onCreerOuProlonger: () => void
  onSupprimer: () => void
  enCours: boolean
  erreur: string | null
}) {
  return (
    <section aria-labelledby="titre-cadeaux" className="iozy-verre iozy-verre--fort flex flex-col gap-3 rounded-3xl p-5">
      <h2 id="titre-cadeaux" className="flex items-center gap-2 font-display text-xl font-bold text-textPrimary">
        <Gift size={20} aria-hidden="true" />
        Liste de cadeaux
      </h2>
      <p className="text-sm text-textDim">
        Un lien qui ne montre que tes envies, pour un anniversaire ou les fêtes. Il cesse de marcher au bout de 30 jours.
      </p>
      {erreur && <ErrorBanner message={erreur} />}
      {!lien ? (
        <button type="button" className="btn-primaire w-fit" onClick={onCreerOuProlonger} disabled={enCours}>
          {enCours ? 'Création…' : 'Créer ma liste de cadeaux'}
        </button>
      ) : (
        <>
          <p className="text-sm font-semibold text-textPrimary">{etatListe(lien)}</p>
          <p className="rounded-xl bg-verre px-3 py-2 text-xs break-all text-textDim">{adresseDuLien(lien.token)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <BoutonCopier texte={adresseDuLien(lien.token)} libelle="Copier la liste" primaire={false} />
            <button type="button" className="btn-secondaire" onClick={onCreerOuProlonger} disabled={enCours}>
              <RefreshCw size={16} />
              Prolonger de 30 jours
            </button>
            <ActionEnDeuxTemps
              libelle="Supprimer la liste"
              confirmation="Oui, supprimer"
              explication="Le lien de la liste cessera de marcher."
              onConfirmer={onSupprimer}
              enCours={enCours}
              icone={<Trash2 size={16} />}
            />
          </div>
        </>
      )}
    </section>
  )
}
