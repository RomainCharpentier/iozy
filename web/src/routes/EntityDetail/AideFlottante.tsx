import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Sparkles, X } from 'lucide-react'
import type { QuestionAssistant } from './AssistantSection'

export interface QuestionProposee {
  cle: QuestionAssistant
  libelle: string
}

/**
 * Le bouton « Aide » flottant de la maquette, et le panneau qu'il ouvre.
 *
 * <h2>Flottant plutôt que dans le flux</h2>
 * L'assistant a déjà déménagé deux fois - une section propre, puis une
 * pastille dans une barre. La maquette le sort carrément du flux : la fiche
 * peut être longue (soixante-douze tomes), et une aide qui ne sert
 * qu'occasionnellement ne doit ni pousser le contenu vers le bas, ni obliger
 * à remonter pour la trouver. Elle reste à portée quel que soit l'endroit où
 * on a défilé.
 *
 * <h2>Ce qui reste vrai</h2>
 * Des questions FIXES à réponse CALCULÉE sur les données déjà chargées -
 * jamais de saisie libre, jamais d'appel à un modèle de langage (voir
 * AssistantSection pour ce qui est répondable et ce qui ne l'est pas).
 */
export function AideFlottante({
  titreSerie,
  questions,
  question,
  onQuestion,
  reponse,
}: {
  titreSerie: string
  questions: QuestionProposee[]
  question: QuestionAssistant | null
  onQuestion: (question: QuestionAssistant | null) => void
  /** La réponse rendue par la page (voir ReponseAssistant) - le panneau ne
   *  sait pas répondre, il ne fait qu'ouvrir la question. */
  reponse: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const declencheurRef = useRef<HTMLButtonElement>(null)
  const panneauRef = useRef<HTMLDivElement>(null)

  // À l'ouverture, le focus entre DANS le panneau.
  //
  // Sans ça, il restait sur le bouton « Aide » - et comme le panneau est rendu
  // AVANT son déclencheur dans le DOM (colonne ancrée en bas, le bouton en
  // dernier), Tab emmenait au clavier vers le reste de la page : le panneau
  // qu'on vient d'ouvrir n'était atteignable qu'en revenant en arrière par
  // Maj+Tab. Mesuré : premier élément focalisable du panneau en position 27 de
  // l'ordre de tabulation, déclencheur en 30.
  //
  // Le piège à focus de `useModalA11y` ne conviendrait pas ici : ce panneau
  // n'est PAS modal (pas d'`aria-modal`, pas de voile, la page reste utilisable
  // derrière) et enfermer le clavier dans une surface non modale serait un
  // défaut de plus, pas un de moins. Seul le focus initial manquait. La
  // convention du repère de focus, elle, est bien celle de la maison
  // (`data-modal-initial-focus`, voir useModalA11y) : la première question,
  // jamais le bouton « Fermer » qui la précède visuellement.
  useEffect(() => {
    if (!ouvert) return
    const panneau = panneauRef.current
    if (!panneau) return
    const cible =
      panneau.querySelector<HTMLElement>('[data-modal-initial-focus]') ??
      panneau.querySelector<HTMLElement>('button,a[href],input,select,textarea')
    cible?.focus()
  }, [ouvert])

  // Échap ferme d'abord la réponse ouverte, puis le panneau - c'est l'ordre
  // de la maquette, et celui qu'on attend : la première pression ne doit pas
  // tout refermer quand on vient juste d'ouvrir une réponse.
  useEffect(() => {
    if (!ouvert) return
    function auClavier(evenement: KeyboardEvent) {
      if (evenement.key !== 'Escape') return
      if (question) {
        onQuestion(null)
        return
      }
      setOuvert(false)
      declencheurRef.current?.focus()
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [ouvert, question, onQuestion])

  function fermer() {
    setOuvert(false)
    onQuestion(null)
  }

  return (
    // `bottom` généreux en dessous du point de bascule : la barre du pouce
    // (TabBar, fixed) occupe déjà le bas de l'écran, et le bouton se
    // poserait dessus.
    <div className="fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2.5 md:right-7 md:bottom-7">
      {ouvert && (
        <div
          ref={panneauRef}
          role="dialog"
          aria-label={`Aide sur ${titreSerie}`}
          className="flex w-[min(304px,calc(100vw-2.5rem))] flex-col gap-3 rounded-2xl bg-surface p-4 shadow-token-elevated ring-1 ring-line ring-inset"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate font-display text-sm font-medium tracking-[-0.01em] text-textPrimary">
              {titreSerie}
            </span>
            <button
              type="button"
              onClick={fermer}
              aria-label="Fermer l'aide"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-faint hover:bg-softBtn hover:text-textPrimary"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {questions.map(({ cle, libelle }, index) => (
              <button
                key={cle}
                type="button"
                data-modal-initial-focus={index === 0 ? '' : undefined}
                onClick={() => onQuestion(question === cle ? null : cle)}
                aria-expanded={question === cle}
                className={`flex items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-[13px] transition-colors ${
                  question === cle ? 'bg-accentTint text-accentText' : 'bg-softBtn text-textDim hover:text-textPrimary'
                }`}
              >
                {libelle}
                <ChevronRight size={14} className="shrink-0" />
              </button>
            ))}
          </div>

          {/* La réponse peut être longue (une liste de plages de tomes) : elle
              défile DANS le panneau plutôt que de le faire grandir au-delà de
              l'écran, puisqu'il est ancré en bas. */}
          {question && <div className="max-h-[46vh] overflow-y-auto">{reponse}</div>}
        </div>
      )}

      <button
        ref={declencheurRef}
        type="button"
        onClick={() => (ouvert ? fermer() : setOuvert(true))}
        aria-expanded={ouvert}
        className="flex items-center gap-2.5 rounded-full bg-surface py-[11px] pr-4 pl-3.5 text-[13px] font-medium whitespace-nowrap text-textDim shadow-token-elevated ring-1 ring-line transition-transform ring-inset hover:-translate-y-px hover:text-accentText"
      >
        <Sparkles size={17} className="text-accent" />
        Aide
      </button>
    </div>
  )
}
