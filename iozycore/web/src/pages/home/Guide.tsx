import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Send } from 'lucide-react'
import { Link } from 'react-router-dom'
import { askGuide } from '@/common/api/home'
import { useAuth } from '@/common/hooks/useAuth'

/** One thing the guide says by itself: a sentence built from real data, and where it leads. */
export interface Conseil {
  cle: string
  texte: ReactNode
  to: string
  action: string
}

const SUGGESTIONS = ['Que devrais-je acheter en premier ?', 'Qu’est-ce que je peux finir bientôt ?', 'Résume ma collection']

/**
 * Izy, the guide of the home page: a small character that says what deserves
 * attention, and answers questions about the collection.
 *
 * <h2>Two voices, and the screen says which one speaks</h2>
 * By itself, Izy shows sentences computed from the collection (what is almost
 * done, the next release): no model, each one leads somewhere, a click on Izy
 * shows the next. Asked a question, Izy answers through the server (POST
 * /api/home/guide): a language model reads the works of the account and
 * writes a few sentences. The answer says that an AI wrote it; when no model
 * is available, the server answers with a computed sentence and says so.
 */
export function Guide({ conseils }: { conseils: Conseil[] }) {
  const { estInvite } = useAuth()
  const [rang, setRang] = useState(0)
  const [question, setQuestion] = useState('')
  const demande = useMutation({ mutationFn: (q: string | null) => askGuide(q) })
  const conseil = conseils.length > 0 ? conseils[rang % conseils.length] : null
  const plusieurs = conseils.length > 1
  const reponse = demande.data

  function demander(texte: string) {
    const propre = texte.trim()
    if (demande.isPending) return
    setQuestion(propre)
    demande.mutate(propre || null)
  }

  function envoyer(event: FormEvent) {
    event.preventDefault()
    demander(question)
  }

  function suivant() {
    demande.reset()
    setRang((r) => r + 1)
  }

  return (
    <section aria-label="Izy, ton guide" className="flex items-start gap-4">
      <button
        type="button"
        onClick={suivant}
        disabled={!plusieurs && !reponse}
        aria-label={plusieurs ? 'Izy : conseil suivant' : 'Izy'}
        title={plusieurs ? 'Conseil suivant' : undefined}
        className="guide mt-1 h-16 w-16 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-default"
      >
        <Izy />
      </button>
      <div className="tuile flex min-w-0 flex-1 flex-col gap-3 rounded-[22px] rounded-tl-md px-5 py-4 lg:max-w-3xl">
        <div aria-live="polite" key={demande.isPending ? 'attente' : reponse ? reponse.text : (conseil?.cle ?? 'vide')} className="guide__bulle">
          {demande.isPending ? (
            <p className="font-display text-lg font-semibold text-textDim">Izy regarde ta collection…</p>
          ) : demande.isError ? (
            <p className="text-[15px] text-dangerText">Izy n’a pas pu répondre : {demande.error.message}</p>
          ) : reponse ? (
            <>
              <p className="text-[17px] leading-relaxed text-textPrimary">{reponse.text}</p>
              <p className="mt-1.5 text-xs text-textDim">
                {reponse.ai ? 'Écrit par une IA à partir de ta collection : vérifie avant d’acheter.' : (reponse.note ?? 'Réponse calculée, sans IA.')}
              </p>
            </>
          ) : conseil ? (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <p className="min-w-0 font-display text-lg leading-snug font-semibold text-textPrimary [&_em]:text-accentText [&_em]:not-italic">
                {conseil.texte}
              </p>
              <Link to={conseil.to} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold whitespace-nowrap text-accentText hover:underline">
                {conseil.action} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <p className="font-display text-lg font-semibold text-textPrimary">Pose-moi une question sur ta collection.</p>
          )}
        </div>
        {!estInvite && (
          <>
            <form onSubmit={envoyer} className="flex items-center gap-2">
              <label htmlFor="question-izy" className="sr-only">
                Ta question à Izy
              </label>
              <input
                id="question-izy"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={300}
                placeholder="Demande quelque chose à Izy"
                className="champ min-w-0 flex-1"
              />
              <button type="submit" disabled={demande.isPending} aria-label="Envoyer la question à Izy" className="btn-primaire !px-4">
                <Send size={16} aria-hidden="true" />
              </button>
            </form>
            <ul className="flex flex-wrap gap-2" aria-label="Questions proposées">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    disabled={demande.isPending}
                    onClick={() => demander(suggestion)}
                    className="min-h-11 rounded-full border border-ligneVerre px-3.5 text-sm font-medium text-textDim hover:border-accent hover:text-textPrimary disabled:opacity-60"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}

/** The character: a small rounded volume with a bookmark, two eyes and a smile. */
function Izy() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-full w-full">
      <ellipse cx="32" cy="59" rx="15" ry="3" className="fill-textPrimary opacity-15" />
      <path d="M42 6h9v15l-4.5-3.5L42 21z" className="fill-textPrimary" />
      <rect x="9" y="9" width="46" height="46" rx="15" className="fill-accent" />
      <rect x="9" y="9" width="9" height="46" rx="4.5" className="fill-textPrimary opacity-15" />
      <g className="guide__yeux">
        <ellipse cx="27" cy="30" rx="5" ry="6" fill="#fff" />
        <ellipse cx="43" cy="30" rx="5" ry="6" fill="#fff" />
        <circle cx="28" cy="31" r="2.6" fill="#1c1714" />
        <circle cx="44" cy="31" r="2.6" fill="#1c1714" />
        <circle cx="29" cy="29.8" r="0.9" fill="#fff" />
        <circle cx="45" cy="29.8" r="0.9" fill="#fff" />
      </g>
      <path d="M30 41q5 4.5 10 0" fill="none" stroke="#1c1714" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="21" cy="39" r="2.6" fill="#fff" opacity="0.28" />
      <circle cx="49" cy="39" r="2.6" fill="#fff" opacity="0.28" />
    </svg>
  )
}
