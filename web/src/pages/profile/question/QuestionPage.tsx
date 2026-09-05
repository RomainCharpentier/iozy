import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { poserQuestion } from '@/common/api/insights'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import type { CollectionAnswerDto } from '@/common/types/api'

/**
 * « Quels mangas j'ai commencés sans finir ? » - la collection interrogée en
 * français (V3 de docs/CONCEPTION.md §15).
 *
 * <h2>Ce qu'on promet, et ce qu'on ne promet pas</h2>
 * La réponse vient d'un modèle, et l'écran le dit en toutes lettres : elle
 * n'est ni persistée ni mêlée aux données - même règle qu'en Analyse d'achat.
 * Ce qui EST garanti : les œuvres citées en dessous sont de vraies fiches,
 * vérifiées côté serveur contre ce qui a été envoyé au modèle. Vérifier une
 * réponse coûte un clic.
 *
 * <h2>Quand l'instance n'a pas de clé</h2>
 * Le serveur répond 204 : la fonctionnalité n'existe pas ici, ce n'est pas
 * une panne. L'écran explique quoi configurer plutôt que d'afficher un
 * formulaire qui ne mènerait nulle part.
 */
const EXEMPLES = [
  'Quelles séries ai-je commencées sans les finir ?',
  'Combien ai-je dépensé cette année, et pour quoi ?',
  'Quelles séries sont à un ou deux tomes d’être complètes ?',
  'Qu’est-ce que j’ai le mieux noté ?',
]

const CONFIANCE: Record<CollectionAnswerDto['confiance'], string> = {
  HIGH: 'les données répondent complètement',
  MEDIUM: 'les données répondent en partie',
  LOW: 'les données ne permettent pas vraiment de répondre',
}

export function QuestionPage() {
  const [question, setQuestion] = useState('')
  const demande = useMutation({ mutationFn: poserQuestion })
  const indisponible = demande.isSuccess && demande.data === undefined

  function envoyer(e: FormEvent) {
    e.preventDefault()
    if (question.trim()) demande.mutate(question.trim())
  }

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/profile', libelle: 'Mon profil' }} />

      <EnTeteSection
        niveau={1}
        titre="Demander à ma collection"
        sousTitre="Pose une question en français : une IA répond à partir de tes œuvres, exemplaires, lectures et envies - et cite les fiches sur lesquelles elle s’appuie, pour que tu puisses vérifier."
      />

      <form onSubmit={envoyer} className="flex flex-col gap-2">
        <label htmlFor="question" className="text-sm text-textDim">
          Ta question
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Quelles séries ai-je commencées sans les finir ?"
          className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={demande.isPending || !question.trim()}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accentInk disabled:opacity-50"
          >
            {demande.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {demande.isPending ? 'Je regarde ta collection…' : 'Demander'}
          </button>
          <span className="text-xs text-textDim">{question.length}/500</span>
        </div>
      </form>

      {/* Des exemples plutôt qu'un champ vide : ils disent ce que la
          fonctionnalité sait faire mieux qu'une phrase d'aide. */}
      <div className="flex flex-wrap gap-2">
        {EXEMPLES.map((exemple) => (
          <button
            key={exemple}
            type="button"
            onClick={() => setQuestion(exemple)}
            className="rounded-full bg-surface px-3 py-1.5 text-xs text-textDim hover:bg-surface2 hover:text-textPrimary"
          >
            {exemple}
          </button>
        ))}
      </div>

      {demande.isError && <ErrorBanner message={demande.error.message} />}

      {indisponible && (
        <div className="rounded-xl bg-surface p-4 text-sm text-textDim">
          Cette instance n’a pas de clé IA : la question ne peut pas être posée. Pour l’activer, renseigne{' '}
          <code className="rounded bg-surface2 px-1 text-textPrimary">GEMINI_API_KEY</code> côté serveur (palier gratuit,
          voir le README) - la même clé que pour l’assistance de l’analyse d’achat.
        </div>
      )}

      {demande.data && <Reponse reponse={demande.data} />}
    </div>
  )
}

function Reponse({ reponse }: { reponse: CollectionAnswerDto }) {
  return (
    <section aria-labelledby="titre-reponse" className="flex flex-col gap-3 rounded-xl border border-dashed border-warning/60 bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titre-reponse" className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
          <Sparkles size={14} className="text-warning" />
          Réponse de l’IA — à vérifier
        </h2>
        <span className="text-xs text-textDim">Confiance : {CONFIANCE[reponse.confiance]}</span>
      </div>
      <p className="whitespace-pre-line text-sm text-textPrimary">{reponse.reponse}</p>
      {reponse.oeuvres.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-textDim uppercase">Les fiches citées</span>
          <ul className="flex flex-wrap gap-2">
            {reponse.oeuvres.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/entity/${o.id}`}
                  state={{ retour: { to: '/question', libelle: 'Ma question' } }}
                  className="inline-flex min-h-9 items-center rounded-lg bg-surface2 px-3 text-sm font-medium text-textPrimary hover:bg-accentTint"
                >
                  {o.titre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-textDim">
        Générée par un modèle à partir d’un instantané de ta collection ; rien n’est enregistré. Les fiches ci-dessus
        sont les seules garanties : le texte peut se tromper.
      </p>
    </section>
  )
}
