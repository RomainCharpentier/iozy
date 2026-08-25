import { BookMarked, Info, Star } from 'lucide-react'

/** Les trois façons de regarder une œuvre. Ce ne sont pas des groupes
 *  inventés pour la mise en page : ce sont les trois axes du modèle, ceux que
 *  ce dépôt répète depuis le début - Possession ≠ Expérience ≠ Catalogue.
 *  Ranger la fiche selon eux, c'est montrer la règle plutôt que la brouiller. */
export type OngletFiche = 'tomes' | 'avis' | 'oeuvre'

const ONGLETS: { cle: OngletFiche; libelle: string; icone: typeof Info }[] = [
  { cle: 'tomes', libelle: 'Mes tomes', icone: BookMarked },
  { cle: 'avis', libelle: 'Mon avis', icone: Star },
  { cle: 'oeuvre', libelle: "L'œuvre", icone: Info },
]

/**
 * La barre d'onglets de la fiche - sous 1100px uniquement.
 *
 * <h2>Pourquoi seulement en petit</h2>
 * Au-delà de 1100px la fiche a deux colonnes et montre tout à la fois : des
 * onglets n'y cacheraient que ce qu'il y a la place d'afficher. En dessous, la
 * fiche d'une série faisait 2081px de haut - six écrans de téléphone à
 * dérouler pour atteindre ses relations. Trois panneaux courts valent mieux
 * qu'un long tunnel.
 *
 * <h2>Des boutons, pas un `tablist` ARIA</h2>
 * Le motif ARIA « tabs » suppose des panneaux qui s'excluent. Ici ils
 * s'excluent en petit et coexistent en grand : annoncer `role="tab"` serait
 * faux la moitié du temps. Des boutons à `aria-pressed`, eux, disent la vérité
 * aux deux largeurs - et chaque panneau garde son propre titre de section, qui
 * reste le vrai repère de navigation.
 */
export function OngletsFiche({
  actif,
  onChange,
}: {
  actif: OngletFiche
  onChange: (onglet: OngletFiche) => void
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface2 p-1 min-[1100px]:hidden">
      {ONGLETS.map(({ cle, libelle, icone: Icone }) => {
        const estActif = cle === actif
        return (
          <button
            key={cle}
            type="button"
            onClick={() => onChange(cle)}
            aria-pressed={estActif}
            className={
              estActif
                ? 'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface text-sm font-semibold text-textPrimary shadow-token-sm'
                : 'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-textDim'
            }
          >
            <Icone size={15} className="shrink-0" />
            {libelle}
          </button>
        )
      })}
    </div>
  )
}
