import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Sparkles, X } from 'lucide-react'
import type { QuestionAssistant } from './AssistantSection'

export interface QuestionProposee {
  cle: QuestionAssistant
  libelle: string
}

/**
 * The floating "Aide" button of the mockup, and the panel it opens.
 *
 * <h2>Floating rather than in the flow</h2>
 * The assistant has already moved twice - its own section, then a
 * pill in a bar. The mockup takes it out of the flow completely: the detail page
 * can be long (seventy-two volumes), and a help that is only
 * needed sometimes must not push the content down, nor force the user
 * to scroll back up to find it. It stays within reach wherever
 * the user has scrolled.
 *
 * <h2>What stays true</h2>
 * FIXED questions with a COMPUTED answer on the data already loaded -
 * never free text input, never a call to a language model (see
 * AssistantSection for what can be answered and what cannot).
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
  /** The answer rendered by the page (see ReponseAssistant) - the panel does not
   *  know how to answer, it only opens the question. */
  reponse: React.ReactNode
}) {
  const [ouvert, setOuvert] = useState(false)
  const declencheurRef = useRef<HTMLButtonElement>(null)
  const panneauRef = useRef<HTMLDivElement>(null)

  // When it opens, the focus moves INTO the panel.
  //
  // Without this, it stayed on the "Aide" button - and since the panel is rendered
  // BEFORE its trigger in the DOM (column anchored at the bottom, the button
  // last), Tab took the keyboard to the rest of the page: the panel
  // that was just opened could only be reached by going back with
  // Shift+Tab. Measured: first focusable element of the panel at position 27 of
  // the tab order, trigger at 30.
  //
  // The focus trap of `useModalA11y` would not fit here: this panel
  // is NOT modal (no `aria-modal`, no overlay, the page stays usable
  // behind it) and locking the keyboard in a non-modal surface would be
  // one more defect, not one less. Only the initial focus was missing. The
  // convention for the focus marker is the house one
  // (`data-modal-initial-focus`, see useModalA11y): the first question,
  // never the "Fermer" button that comes before it visually.
  useEffect(() => {
    if (!ouvert) return
    const panneau = panneauRef.current
    if (!panneau) return
    const cible =
      panneau.querySelector<HTMLElement>('[data-modal-initial-focus]') ??
      panneau.querySelector<HTMLElement>('button,a[href],input,select,textarea')
    cible?.focus()
  }, [ouvert])

  // Escape closes the open answer first, then the panel - this is the order
  // of the mockup, and the one people expect: the first press must not
  // close everything when an answer was just opened.
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
    // A generous `bottom` below the breakpoint: the thumb bar
    // (TabBar, fixed) already takes the bottom of the screen, and the button
    // would sit on top of it.
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

          {/* The answer can be long (a list of volume ranges): it
              scrolls INSIDE the panel rather than making it grow beyond
              the screen, since it is anchored at the bottom. */}
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
