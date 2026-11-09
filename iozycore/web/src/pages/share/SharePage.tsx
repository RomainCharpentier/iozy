import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link2Off, RefreshCw } from 'lucide-react'
import { listWorks } from '@/common/api/works'
import { queryKeys } from '@/common/lib/queryKeys'
import { usePleinCadre } from '@/common/components/pleinCadre/usePleinCadre'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { Squelette } from '@/common/components/Squelette'
import type { ShareDto } from '@/common/types/share'
import { EspacePartage } from './EspacePartage'
import { BlocIncontournables } from './BlocIncontournables'
import { BlocCadeaux } from './BlocCadeaux'
import { BlocBilan } from './BlocBilan'
import { ActionEnDeuxTemps, BoutonCopier, Interrupteur } from './Commandes'
import { adresseDuLien, usePartage } from './usePartage'
import { jaquettesDuPartage } from './libelles'

/**
 * "Partager" (lot 217): the fourth goal of the owner.
 *
 * <h2>One page, what visitors see beside it</h2>
 * On the left, what is decided: the link (copy, regenerate and deactivate in
 * two steps), what it shows, "Mes 4 incontournables", the gift list and the
 * image of the year. On the right, the public page itself, drawn by the same
 * component as the public route from the current choices: the preview never
 * says something else than the link.
 *
 * <h2>The backdrop</h2>
 * The first pinned work, as on the public page.
 */
export function SharePage() {
  const { partage, apercu, apercuCadeaux, generer, modifier, desactiver, epingler, creerListe, supprimerListe } =
    usePartage()
  const oeuvres = useQuery({ queryKey: queryKeys.works.list, queryFn: listWorks })
  const [vue, setVue] = useState<'page' | 'cadeaux'>('page')
  const share = partage.data
  const epinglees = share?.pinnedWorkIds ?? []
  const jaquettes = jaquettesDuPartage(oeuvres.data ?? [], epinglees)
  usePleinCadre(jaquettes[0] ?? null)

  const giftLink = share?.giftLink ?? null
  const vueEffective = vue === 'cadeaux' && giftLink ? 'cadeaux' : 'page'
  const apercuAffiche = vueEffective === 'cadeaux' ? apercuCadeaux : apercu

  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6 lg:pt-4">
        <header className="flex flex-col gap-3">
          <span className="iozy-teinte text-[13px] font-semibold tracking-[0.16em] text-accentText uppercase">
            Partager
          </span>
          <h1 className="font-display text-[clamp(44px,8vw,84px)] leading-[0.92] font-bold tracking-[-0.035em] text-textPrimary">
            Ta page publique
          </h1>
          <p className="text-base text-textDim">
            {share?.token
              ? 'Active · en lecture seule, personne ne peut rien modifier.'
              : 'Pas encore de lien : ta page n’est visible par personne.'}
          </p>
        </header>

        {partage.isPending ? (
          <Squelette lignes={4} />
        ) : partage.isError ? (
          <ErrorBanner message={partage.error.message} />
        ) : (
          <>
            <BlocLien
              share={share!}
              onGenerer={() => generer.mutate()}
              onDesactiver={() => desactiver.mutate()}
              enCours={generer.isPending || desactiver.isPending}
              erreur={generer.error?.message ?? desactiver.error?.message ?? null}
            />
            <BlocSections
              share={share!}
              onModifier={(sections) => modifier.mutate(sections)}
              enCours={modifier.isPending}
              erreur={modifier.error?.message ?? null}
            />
            <BlocIncontournables
              oeuvres={oeuvres.data ?? []}
              epinglees={epinglees}
              onChanger={(ids) => epingler.mutate(ids)}
              enCours={epingler.isPending}
              erreur={epingler.error?.message ?? null}
            />
            <BlocCadeaux
              lien={giftLink}
              onCreerOuProlonger={() => creerListe.mutate()}
              onSupprimer={() => supprimerListe.mutate()}
              enCours={creerListe.isPending || supprimerListe.isPending}
              erreur={creerListe.error?.message ?? supprimerListe.error?.message ?? null}
            />
            <BlocBilan jaquettes={jaquettes} />
          </>
        )}
      </div>

      <section aria-labelledby="titre-apercu" className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-24">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 id="titre-apercu" className="font-display text-xl font-bold text-textPrimary">
            Ce que voient tes visiteurs
          </h2>
          {giftLink && (
            <div role="group" aria-label="Aperçu de" className="iozy-verre flex gap-1 rounded-full p-1">
              {(
                [
                  ['page', 'Ma page'],
                  ['cadeaux', 'Liste de cadeaux'],
                ] as const
              ).map(([cle, libelle]) => (
                <button
                  key={cle}
                  type="button"
                  aria-pressed={vueEffective === cle}
                  onClick={() => setVue(cle)}
                  className={`iozy-teinte min-h-11 rounded-full px-4 text-sm font-semibold ${
                    vueEffective === cle ? 'bg-vive text-encreVive' : 'text-textDim hover:text-textPrimary'
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="iozy-verre max-h-[calc(100vh-9rem)] overflow-auto rounded-[28px] p-5 sm:p-7">
          {apercuAffiche.isPending ? (
            <Squelette lignes={5} />
          ) : apercuAffiche.isError ? (
            <ErrorBanner message={apercuAffiche.error.message} />
          ) : (
            <EspacePartage data={apercuAffiche.data} enApercu />
          )}
        </div>
      </section>
    </div>
  )
}

function BlocLien({
  share,
  onGenerer,
  onDesactiver,
  enCours,
  erreur,
}: {
  share: ShareDto
  onGenerer: () => void
  onDesactiver: () => void
  enCours: boolean
  erreur: string | null
}) {
  if (!share.token) {
    return (
      <div className="flex flex-col gap-3">
        {erreur && <ErrorBanner message={erreur} />}
        <button type="button" onClick={onGenerer} disabled={enCours} className="btn-primaire h-[54px] w-fit rounded-full px-7 text-base">
          {enCours ? 'Activation…' : 'Activer ma page'}
        </button>
        <p className="text-sm text-textDim">
          Un lien à envoyer : personne n’a besoin d’un compte pour l’ouvrir, et tu peux le couper à tout moment.
        </p>
      </div>
    )
  }
  const url = adresseDuLien(share.token)
  return (
    <div className="flex flex-col gap-3">
      {erreur && <ErrorBanner message={erreur} />}
      <p className="iozy-verre rounded-2xl px-4 py-3 text-sm break-all text-textPrimary">{url}</p>
      <div className="flex flex-wrap items-center gap-2">
        <BoutonCopier texte={url} />
        <ActionEnDeuxTemps
          libelle="Régénérer le lien"
          confirmation="Oui, régénérer"
          explication="L’ancien lien cessera de marcher."
          onConfirmer={onGenerer}
          enCours={enCours}
          icone={<RefreshCw size={16} />}
        />
        <ActionEnDeuxTemps
          libelle="Désactiver le partage"
          confirmation="Oui, désactiver"
          explication="Ta page ne sera plus visible par personne."
          onConfirmer={onDesactiver}
          enCours={enCours}
          icone={<Link2Off size={16} />}
        />
      </div>
    </div>
  )
}

function BlocSections({
  share,
  onModifier,
  enCours,
  erreur,
}: {
  share: ShareDto
  onModifier: (sections: { shareCollection?: boolean; shareWishlist?: boolean; includeTierLists?: boolean; showValue?: boolean }) => void
  enCours: boolean
  erreur: string | null
}) {
  // Unchecking the last visible section is refused by the server: the switch is
  // disabled and says why, instead of letting the person run into an error.
  const derniere = (section: 'collection' | 'wishlist') =>
    !!share.token &&
    (section === 'collection' ? share.shareCollection && !share.shareWishlist : share.shareWishlist && !share.shareCollection)
  return (
    <section aria-labelledby="titre-sections" className="iozy-verre iozy-verre--fort flex flex-col gap-1 rounded-3xl p-4">
      <h2 id="titre-sections" className="px-2 pb-1 text-[13px] font-semibold tracking-[0.12em] text-textDim uppercase">
        Ce que montre ta page
      </h2>
      <Interrupteur
        titre="Ma collection"
        detail={derniere('collection') ? 'Au moins une section doit rester visible' : 'Les œuvres que tu possèdes'}
        actif={share.shareCollection}
        desactive={enCours || derniere('collection')}
        onBasculer={(valeur) => onModifier({ shareCollection: valeur })}
      />
      <Interrupteur
        titre="Mes envies"
        detail={derniere('wishlist') ? 'Au moins une section doit rester visible' : 'Les œuvres que tu souhaites obtenir'}
        actif={share.shareWishlist}
        desactive={enCours || derniere('wishlist')}
        onBasculer={(valeur) => onModifier({ shareWishlist: valeur })}
      />
      {share.shareCollection && (
        <>
          <Interrupteur
            titre="Mes Tier Lists"
            detail="Tes classements, avec la collection"
            actif={share.includeTierLists}
            desactive={enCours}
            onBasculer={(valeur) => onModifier({ includeTierLists: valeur })}
            retrait
          />
          <Interrupteur
            titre="Valeur estimée"
            detail="Montrée seulement si au moins 5 objets ont un prix, et la moitié de ta collection"
            actif={!!share.showValue}
            desactive={enCours}
            onBasculer={(valeur) => onModifier({ showValue: valeur })}
            retrait
          />
        </>
      )}
      {erreur && <ErrorBanner message={erreur} />}
    </section>
  )
}
