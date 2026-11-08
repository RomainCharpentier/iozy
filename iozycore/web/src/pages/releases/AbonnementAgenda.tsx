import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CalendarPlus, Check, Copy, RefreshCw, X } from 'lucide-react'
import { revokeCalendarSubscription, subscribeToCalendar } from '@/common/api/calendar'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import type { CalendarSubscriptionDto } from '@/common/types/api'
import { liensAbonnement } from './releaseCalendar'

/**
 * "S'abonner dans mon agenda" (lot 215): replaces the .ics file of before.
 * A file was a copy, frozen the day it was saved; a subscription is read
 * again by the agenda app, so a moved release moves there too.
 *
 * <p>The link is secret: whoever holds it reads the releases, nothing else.
 * "Nouveau lien" revokes it and draws another one - the agendas that used the
 * old one stop receiving releases.
 */
export function AbonnementAgenda() {
  const [ouvert, setOuvert] = useState(false)
  const [copie, setCopie] = useState<string | null>(null)

  const [lienRenouvele, setLienRenouvele] = useState<CalendarSubscriptionDto | null>(null)
  const abonnement = useMutation({ mutationFn: subscribeToCalendar })
  const renouveler = useMutation({
    mutationFn: async () => {
      await revokeCalendarSubscription()
      return subscribeToCalendar()
    },
    onSuccess: (nouveau) => setLienRenouvele(nouveau),
  })
  const lien = lienRenouvele ?? abonnement.data ?? null

  function ouvrir() {
    setOuvert(true)
    if (!lien && !abonnement.isPending) abonnement.mutate()
  }

  async function copier(texte: string, quoi: string) {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(quoi)
      setTimeout(() => setCopie(null), 2000)
    } catch {
      // Refused outside a secure context: the link stays shown and selectable,
      // no copy is announced that did not take place.
    }
  }

  if (!ouvert) {
    return (
      <button type="button" onClick={ouvrir} className="btn-secondaire flex items-center gap-2 self-start">
        <CalendarPlus size={16} aria-hidden="true" />
        S'abonner dans mon agenda
      </button>
    )
  }

  const liens = lien ? liensAbonnement(lien.feedPath, window.location.origin) : null
  const erreur = abonnement.error ?? renouveler.error

  return (
    <section aria-labelledby="abonnement-titre" className="iozy-verre flex flex-col gap-3 rounded-[20px] p-4 md:max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <h2 id="abonnement-titre" className="font-display text-lg font-bold tracking-[-0.02em] text-textPrimary">
          S'abonner dans mon agenda
        </h2>
        <button
          type="button"
          onClick={() => setOuvert(false)}
          aria-label="Fermer"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-textDim"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {erreur && <ErrorBanner message={erreur.message} />}
      {!liens && !erreur && <p className="text-sm text-textDim">Création du lien…</p>}

      {liens && (
        <>
          <LigneLien libelle="Lien webcal://" valeur={liens.webcal} copie={copie === 'webcal'} onCopier={() => copier(liens.webcal, 'webcal')} />
          <LigneLien libelle="Lien https://" valeur={liens.https} copie={copie === 'https'} onCopier={() => copier(liens.https, 'https')} />
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-textDim">
            <li>Google Agenda : « Autres agendas », « + », « À partir de l'URL », puis colle le lien https://.</li>
            <li>Apple Calendrier : ouvre le lien webcal:// sur ton iPhone ou ton Mac, puis « S'abonner ».</li>
            <li>Ton agenda relit le lien de lui-même : une date qui change change aussi chez lui, à son rythme.</li>
          </ul>
          <p className="text-sm text-textDim">
            Ce lien est secret : qui l'a voit tes sorties. Un nouveau lien coupe l'ancien.
          </p>
          <button
            type="button"
            onClick={() => renouveler.mutate()}
            disabled={renouveler.isPending}
            className="btn-secondaire flex items-center gap-2 self-start"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Nouveau lien
          </button>
        </>
      )}
    </section>
  )
}

function LigneLien({ libelle, valeur, copie, onCopier }: { libelle: string; valeur: string; copie: boolean; onCopier: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-textDim">{libelle}</span>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={valeur}
          aria-label={libelle}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 text-sm text-textPrimary"
        />
        <button type="button" onClick={onCopier} className="btn-secondaire flex shrink-0 items-center gap-1.5" aria-label={`Copier le ${libelle}`}>
          {copie ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copie ? 'Copié' : 'Copier'}
        </button>
      </div>
    </div>
  )
}
