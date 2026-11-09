import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Copy } from 'lucide-react'

/**
 * A gesture that takes something back (regenerate, delete): two steps. The
 * first click only asks; the second, on a button that says what will happen,
 * does it. "Annuler" goes back without doing anything.
 */
export function ActionEnDeuxTemps({
  libelle,
  confirmation,
  explication,
  onConfirmer,
  enCours,
  icone,
}: {
  libelle: string
  confirmation: string
  explication: string
  onConfirmer: () => void
  enCours: boolean
  icone?: ReactNode
}) {
  const [demande, setDemande] = useState(false)
  const confirmer = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (demande) confirmer.current?.focus()
  }, [demande])

  if (!demande) {
    return (
      <button type="button" className="btn-secondaire" onClick={() => setDemande(true)} disabled={enCours}>
        {icone}
        {libelle}
      </button>
    )
  }
  return (
    <div role="group" aria-label={libelle} className="iozy-verre flex flex-wrap items-center gap-2 rounded-2xl p-2">
      <p className="px-2 text-sm text-textPrimary">{explication}</p>
      <button
        ref={confirmer}
        type="button"
        className="btn-danger"
        disabled={enCours}
        onClick={() => {
          onConfirmer()
          setDemande(false)
        }}
      >
        {confirmation}
      </button>
      <button type="button" className="btn-discret" onClick={() => setDemande(false)}>
        Annuler
      </button>
    </div>
  )
}

/**
 * Copies an address. Some browsers refuse the clipboard outside a secure
 * context: the address stays shown and selectable, and no copy is announced
 * that did not take place.
 */
export function BoutonCopier({ texte, libelle = 'Copier le lien', primaire = true }: {
  texte: string
  libelle?: string
  primaire?: boolean
}) {
  const [copie, setCopie] = useState(false)
  useEffect(() => {
    if (!copie) return
    const minuterie = setTimeout(() => setCopie(false), 2000)
    return () => clearTimeout(minuterie)
  }, [copie])

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
    } catch {
      setCopie(false)
    }
  }
  return (
    <button type="button" onClick={copier} className={primaire ? 'btn-primaire' : 'btn-secondaire'}>
      <Copy size={16} />
      <span aria-live="polite">{copie ? 'Lien copié' : libelle}</span>
    </button>
  )
}

/** A switch with its title and what it does. */
export function Interrupteur({
  titre,
  detail,
  actif,
  desactive = false,
  onBasculer,
  retrait = false,
}: {
  titre: string
  detail: string
  actif: boolean
  desactive?: boolean
  onBasculer: (valeur: boolean) => void
  retrait?: boolean
}) {
  return (
    <label
      className={`flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 ${retrait ? 'pl-8' : ''} ${
        desactive ? '' : 'cursor-pointer hover:bg-hoverSurface'
      }`}
    >
      <input
        type="checkbox"
        role="switch"
        checked={actif}
        disabled={desactive}
        onChange={(e) => onBasculer(e.target.checked)}
        className="h-5 w-5 shrink-0 accent-accent"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-textPrimary">{titre}</span>
        <span className="text-xs text-textDim">{detail}</span>
      </span>
    </label>
  )
}
