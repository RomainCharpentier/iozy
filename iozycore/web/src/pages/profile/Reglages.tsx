import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Download, Upload, Wrench } from 'lucide-react'
import type { AccentCompte, Compte } from '@/common/api/auth'
import { useAuth } from '@/common/hooks/useAuth'
import { useModifierCompte } from '@/common/hooks/usePreferencesCompte'
import { setAccent, useAccent } from '@/common/lib/accent'
import { useEtatEnregistrement } from '@/common/lib/preferencesCompte'
import { useTheme, type PreferenceTheme } from '@/common/lib/theme'
import { useTitleComposition } from '@/common/lib/titleLanguage'
import { ChoixTitres } from './ChoixTitres'
import { resumeTitres } from './resumeTitres'

/**
 * The common profile, one glass panel (lot 218): the pseudo, the color, the
 * appearance, the title languages, the blindtest sound, and the data.
 *
 * <h2>One place, for both apps</h2>
 * These settings live on the ACCOUNT: IozyCore and IozyTest read them, on
 * any browser. Each one applies at once on this device, which keeps a copy:
 * without an answer from the server, the choice stays here and the panel
 * says so (see usePreferencesCompte). The pseudo and the sound have no local
 * copy in this app: they are saved directly, and a refusal is said on their
 * row.
 *
 * <h2>What is not here</h2>
 * The sign-out is in the header, the same button everywhere. The
 * administration of the instance is a discreet link under the panel, for an
 * administrator only.
 */
export function Reglages({ ouvrirTitres = false }: { ouvrirTitres?: boolean }) {
  const { compte } = useAuth()
  const etat = useEtatEnregistrement()

  if (!compte) return null

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-labelledby="section-mon-compte"
        className="iozy-verre iozy-verre--fort flex flex-col rounded-[26px] px-5 py-2 sm:px-6"
      >
        <h2 id="section-mon-compte" className="sr-only">
          Mon compte
        </h2>
        <LignePseudo compte={compte} />
        <LigneCouleur />
        <LigneApparence />
        <LigneTitres ouvrir={ouvrirTitres} />
        <LigneSon compte={compte} />
        <LigneDonnees />
      </section>
      <p role="status" className="px-2 text-sm text-textDim">
        {etat === 'en-cours'
          ? 'Enregistrement sur ton compte…'
          : etat === 'appareil'
            ? 'Ton compte n’a pas répondu : ce réglage reste sur cet appareil pour l’instant.'
            : 'Ces réglages suivent ton compte, sur IozyCore comme sur IozyTest.'}
      </p>
      {compte.admin && (
        <Link to="/administration" className="btn-discret self-start">
          <Wrench size={15} aria-hidden="true" />
          Administration de l’instance
        </Link>
      )}
    </div>
  )
}

/** One row of the panel: its name on the left, what it holds on the right. */
function Ligne({ titre, idTitre, children }: { titre: string; idTitre: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-ligneVerre py-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-6">
      <h3 id={idTitre} className="shrink-0 pt-2.5 text-base font-semibold text-textPrimary sm:w-44">
        {titre}
      </h3>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>
  )
}

function messageDe(erreur: unknown): string {
  return erreur instanceof Error && erreur.message ? erreur.message : 'Ton compte n’a pas répondu.'
}

/**
 * The pseudo, changed in place. The rules are the sign-up ones, checked by
 * the server, which says why it refuses (form, or taken). The avatar of the
 * top bar follows at once: it reads the same account.
 */
function LignePseudo({ compte }: { compte: Compte }) {
  const [edition, setEdition] = useState(false)
  const [saisie, setSaisie] = useState(compte.pseudo)
  const sauvegarde = useModifierCompte()
  const champ = useRef<HTMLInputElement>(null)
  const ouvreur = useRef<HTMLButtonElement>(null)
  const rendreLeFocus = useRef(false)
  const idAide = useId()

  useEffect(() => {
    if (edition) champ.current?.select()
    else if (rendreLeFocus.current) ouvreur.current?.focus()
  }, [edition])

  function fermer() {
    rendreLeFocus.current = true
    sauvegarde.reset()
    setEdition(false)
  }

  async function soumettre(event: FormEvent) {
    event.preventDefault()
    const pseudo = saisie.trim()
    if (pseudo === compte.pseudo) return fermer()
    try {
      await sauvegarde.mutateAsync({ pseudo })
      fermer()
    } catch {
      // The reason is shown under the field; what was typed stays.
    }
  }

  return (
    <Ligne titre="Pseudo" idTitre="ligne-pseudo">
      {edition ? (
        <form onSubmit={soumettre} className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-textPrimary">
            Nouveau pseudo
            <input
              ref={champ}
              className="champ"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              maxLength={24}
              autoComplete="nickname"
              aria-describedby={idAide}
              aria-invalid={sauvegarde.isError || undefined}
            />
          </label>
          {sauvegarde.isError ? (
            <p id={idAide} role="alert" className="text-sm text-dangerText">
              {messageDe(sauvegarde.error)}
            </p>
          ) : (
            <p id={idAide} className="text-xs text-textDim">
              3 à 24 caractères, sans espace ni arobase. Ton avatar et IozyTest le prennent aussitôt.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primaire" disabled={saisie.trim() === '' || sauvegarde.isPending}>
              Enregistrer
            </button>
            <button type="button" className="btn-discret" onClick={fermer}>
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base text-textPrimary">{compte.pseudo}</span>
            {/* The address signs in, it is never shown as a name. */}
            <span className="truncate text-xs text-textDim">{compte.email}</span>
          </div>
          <button
            ref={ouvreur}
            type="button"
            className="btn-secondaire"
            onClick={() => {
              setSaisie(compte.pseudo)
              setEdition(true)
            }}
          >
            Modifier le pseudo
          </button>
        </div>
      )}
    </Ligne>
  )
}

/** A choice among a few values: real radio buttons, drawn as glass pills. */
function Pastilles<T extends string>({
  nom,
  idTitre,
  valeur,
  options,
  onChoix,
}: {
  nom: string
  idTitre: string
  valeur: T
  options: { valeur: T; libelle: string }[]
  onChoix: (valeur: T) => void
}) {
  return (
    <div role="radiogroup" aria-labelledby={idTitre} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const choisi = option.valeur === valeur
        return (
          <label
            key={option.valeur}
            className={`iozy-teinte relative inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
              choisi ? 'bg-vive text-encreVive ring-transparent' : 'bg-verre text-textPrimary ring-ligneVerre'
            }`}
          >
            <input
              type="radio"
              name={nom}
              value={option.valeur}
              checked={choisi}
              onChange={() => onChoix(option.valeur)}
              className="sr-only"
            />
            {option.libelle}
          </label>
        )
      })}
    </div>
  )
}

function LigneCouleur() {
  const accent = useAccent()
  return (
    <Ligne titre="Couleur" idTitre="ligne-couleur">
      <Pastilles<AccentCompte>
        nom="accent"
        idTitre="ligne-couleur"
        valeur={accent}
        options={[
          { valeur: 'AUTO', libelle: 'Suit la jaquette' },
          { valeur: 'TERRACOTTA', libelle: 'Terracotta' },
        ]}
        onChoix={(choix) => setAccent(choix)}
      />
      <p className="text-xs text-textDim">
        {accent === 'AUTO'
          ? 'Les boutons et ce qui manque prennent la couleur de la jaquette à l’écran.'
          : 'La couleur d’Iozy partout, quelle que soit la jaquette.'}
      </p>
    </Ligne>
  )
}

function LigneApparence() {
  const { preference, setPreference } = useTheme()
  return (
    <Ligne titre="Apparence" idTitre="ligne-apparence">
      <Pastilles<PreferenceTheme>
        nom="apparence"
        idTitre="ligne-apparence"
        valeur={preference}
        options={[
          { valeur: 'system', libelle: 'Système' },
          { valeur: 'dark', libelle: 'Sombre' },
          { valeur: 'light', libelle: 'Clair' },
        ]}
        onChoix={setPreference}
      />
      {preference === 'system' && (
        <p className="text-xs text-textDim">Suit le réglage clair ou sombre de ton appareil.</p>
      )}
    </Ligne>
  )
}

function LigneTitres({ ouvrir }: { ouvrir: boolean }) {
  const composition = useTitleComposition()
  const [ouvert, setOuvert] = useState(ouvrir)
  const ancre = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ouvrir) ancre.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [ouvrir])
  return (
    <Ligne titre="Titres des mangas" idTitre="ligne-titres">
      <div ref={ancre} className="scroll-mt-4 lg:scroll-mt-24" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-base text-textPrimary">{resumeTitres(composition)}</span>
        <button
          type="button"
          className="btn-secondaire"
          aria-expanded={ouvert}
          aria-controls="choix-titres"
          onClick={() => setOuvert((o) => !o)}
        >
          {ouvert ? 'Fermer' : 'Changer l’ordre'}
        </button>
      </div>
      {ouvert && (
        <div id="choix-titres">
          <ChoixTitres />
        </div>
      )}
    </Ligne>
  )
}

/** IozyTest's own default, shown until the account has a sound setting. */
const SON_PAR_DEFAUT = { enabled: true, volume: 70 }

/**
 * The blindtest sound: read by IozyTest from the account when signed in. A
 * volume is saved once the slider rests (a drag is not twenty saves).
 */
function LigneSon({ compte }: { compte: Compte }) {
  const duCompte = compte.preferences?.blindtestSound ?? null
  const son = duCompte ?? SON_PAR_DEFAUT
  const [volume, setVolume] = useState(son.volume)
  const sauvegarde = useModifierCompte()
  const { mutate } = sauvegarde
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The account changed elsewhere (IozyTest, another tab): the slider follows.
  const [volumeLu, setVolumeLu] = useState(son.volume)
  if (volumeLu !== son.volume) {
    setVolumeLu(son.volume)
    setVolume(son.volume)
  }
  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current)
  }, [])

  function enregistrer(enabled: boolean, nouveauVolume: number) {
    mutate({ preferences: { blindtestSound: { enabled, volume: nouveauVolume } } })
  }

  function surVolume(nouveau: number) {
    setVolume(nouveau)
    if (minuteur.current) clearTimeout(minuteur.current)
    minuteur.current = setTimeout(() => enregistrer(son.enabled, nouveau), 400)
  }

  return (
    <Ligne titre="Son du blindtest" idTitre="ligne-son">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-textPrimary">
          <input
            type="checkbox"
            role="switch"
            checked={son.enabled}
            onChange={(e) => enregistrer(e.target.checked, volume)}
            className="h-5 w-5 accent-accent"
          />
          Effets sonores
        </label>
        <div className="flex min-w-[200px] flex-1 items-center gap-3 text-sm text-textPrimary">
          <input
            type="range"
            aria-label="Volume du blindtest"
            aria-valuetext={`${volume} %`}
            min={0}
            max={100}
            step={5}
            value={volume}
            disabled={!son.enabled}
            onChange={(e) => surVolume(Number(e.target.value))}
            className="h-11 flex-1 accent-accent disabled:opacity-40"
          />
          {/* Read by the eye; a screen reader hears the slider's own value. */}
          <span aria-hidden="true" className="w-14 text-right font-display text-lg font-bold tabular-nums">
            {volume} %
          </span>
        </div>
      </div>
      {sauvegarde.isError ? (
        <p role="alert" className="text-sm text-dangerText">
          Pas enregistré : {messageDe(sauvegarde.error)}
        </p>
      ) : (
        <p className="text-xs text-textDim">
          {duCompte
            ? 'IozyTest lit ce réglage : le changer là-bas le change ici.'
            : 'Pas encore réglé sur ton compte : IozyTest garde pour l’instant le réglage de chaque appareil.'}
        </p>
      )}
    </Ligne>
  )
}

function LigneDonnees() {
  return (
    <Ligne titre="Mes données" idTitre="ligne-donnees">
      <p className="text-sm text-textDim">
        Toute ta collection dans un format ouvert, lisible sans cette app, et le chemin du retour. Restent dehors,
        volontairement : l’historique d’analyses d’achat et les jetons de partage, qui sont des secrets.
      </p>
      <div className="flex flex-wrap gap-2">
        <a href="/api/export/json" download className="btn-secondaire">
          <Download size={16} aria-hidden="true" />
          Télécharger en JSON
        </a>
        <a href="/api/export/csv" download className="btn-secondaire">
          Télécharger en CSV (.zip)
        </a>
        <Link to="/profile/import" className="btn-secondaire">
          <Upload size={16} aria-hidden="true" />
          Importer un fichier
        </Link>
      </div>
    </Ligne>
  )
}
