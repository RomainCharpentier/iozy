import { useState, type ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { analyserImport, appliquerImport } from '@/common/api/importation'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { LienRetour } from '@/common/components/LienRetour'
import type { ImportRemarque, ImportReport } from '@/common/types/api'

/**
 * Le retour de « Emporter ma collection » : on rend le fichier JSON, et la
 * collection se reconstruit dans ce compte.
 *
 * <h2>Deux temps, et le premier ne coûte rien</h2>
 * Choisir le fichier lance une <b>analyse</b> : le serveur dit ce qu'il
 * créerait, ce qu'il rattacherait à l'existant, ce qu'il ignorerait - sans
 * rien écrire. C'est l'écran de validation que §19 de docs/CONCEPTION.md
 * réclame avant tout import. « Importer » ne devient possible qu'après, et
 * rejoue exactement la même passe en écrivant, en une transaction.
 *
 * <h2>Ce qui est dit d'emblée</h2>
 * Un import n'écrase jamais : il ajoute ou s'abstient. Une seule exception,
 * les préférences d'analyse d'achat, et le rapport la nomme (« remplacé »).
 */
export function ImportPage() {
  const queryClient = useQueryClient()
  const [nomFichier, setNomFichier] = useState<string | null>(null)
  const [document, setDocument] = useState<unknown>(null)
  const [erreurLecture, setErreurLecture] = useState<string | null>(null)

  const analyse = useMutation({ mutationFn: analyserImport })
  const application = useMutation({
    mutationFn: appliquerImport,
    // Tout peut avoir changé : catalogue, possessions, envies, classements.
    // Invalider en bloc coûte moins qu'oublier une clé.
    onSuccess: () => queryClient.invalidateQueries(),
  })

  async function surFichier(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return
    setErreurLecture(null)
    setDocument(null)
    analyse.reset()
    application.reset()
    setNomFichier(fichier.name)
    try {
      const contenu = JSON.parse(await fichier.text()) as unknown
      setDocument(contenu)
      analyse.mutate(contenu)
    } catch {
      setErreurLecture('Ce fichier n’est pas du JSON lisible. Il faut le fichier téléchargé depuis « Emporter ma collection ».')
    }
  }

  const rapport = application.data ?? analyse.data
  const enCours = analyse.isPending || application.isPending

  return (
    <div className="flex flex-col gap-5">
      <LienRetour parDefaut={{ to: '/settings', libelle: 'Paramètres' }} />

      <EnTeteSection
        niveau={1}
        titre="Restaurer une collection"
        sousTitre="Renvoie un fichier JSON téléchargé depuis « Emporter ma collection ». Rien n’est écrit avant que tu aies vu ce que l’import ferait : ce qui existe déjà est retrouvé, jamais dupliqué ni modifié."
      />

      <div className="flex flex-col gap-2 rounded-xl bg-surface p-4">
        <label htmlFor="fichier-import" className="flex items-center gap-2 font-medium text-textPrimary">
          <Upload size={16} className="shrink-0 text-accentText" />
          Fichier d’export (.json)
        </label>
        <input
          id="fichier-import"
          type="file"
          accept="application/json,.json"
          onChange={surFichier}
          disabled={enCours}
          className="text-sm text-textDim file:mr-3 file:rounded-lg file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-textPrimary hover:file:bg-surface"
        />
        {nomFichier && (
          <p className="text-xs text-textDim" aria-live="polite">
            {analyse.isPending ? `Analyse de ${nomFichier}…` : nomFichier}
          </p>
        )}
      </div>

      {erreurLecture && <ErrorBanner message={erreurLecture} />}
      {analyse.isError && <ErrorBanner message={analyse.error.message} />}
      {application.isError && <ErrorBanner message={application.error.message} />}

      {rapport && (
        <Rapport
          rapport={rapport}
          peutAppliquer={!rapport.applique && document !== null && !enCours}
          appliquer={() => document !== null && application.mutate(document)}
          enCours={application.isPending}
        />
      )}
    </div>
  )
}

function Rapport({
  rapport,
  peutAppliquer,
  appliquer,
  enCours,
}: {
  rapport: ImportReport
  peutAppliquer: boolean
  appliquer: () => void
  enCours: boolean
}) {
  const totalCrees = rapport.sections.reduce((n, s) => n + s.crees, 0)
  const totalIgnores = rapport.sections.reduce((n, s) => n + s.ignores, 0)
  const rienAFaire = totalCrees === 0 && !rapport.sections.some((s) => s.cle === 'collectorPreferences' && s.rattaches > 0)

  return (
    <section aria-labelledby="titre-rapport" className="flex flex-col gap-4">
      <EnTeteSection
        titre={<span id="titre-rapport">{rapport.applique ? 'Import terminé' : 'Ce que l’import ferait'}</span>}
        sousTitre={
          rapport.applique
            ? `${totalCrees} élément(s) ajouté(s) à ta collection.`
            : rienAFaire
              ? 'Tout ce que contient ce fichier est déjà là : il n’y a rien à ajouter.'
              : `${totalCrees} élément(s) seraient ajoutés${totalIgnores > 0 ? `, ${totalIgnores} ignoré(s) - le détail est en dessous.` : '.'}`
        }
        action={
          peutAppliquer &&
          !rienAFaire && (
            <button
              type="button"
              onClick={appliquer}
              disabled={enCours}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accentInk disabled:opacity-50"
            >
              {enCours ? 'Import…' : 'Importer'}
            </button>
          )
        }
      />

      <div className="overflow-x-auto rounded-xl bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-textDim">
              <th scope="col" className="px-4 py-2 font-medium">
                Section
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                {rapport.applique ? 'Créés' : 'À créer'}
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Déjà là
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Ignorés
              </th>
            </tr>
          </thead>
          <tbody>
            {rapport.sections.map((s) => (
              <tr key={s.cle} className="border-t border-line">
                <th scope="row" className="px-4 py-2 text-left font-normal text-textPrimary">
                  {s.libelle}
                </th>
                <td className="px-3 py-2 text-right tabular-nums text-textPrimary">{s.crees}</td>
                <td className="px-3 py-2 text-right tabular-nums text-textDim">{s.rattaches}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${s.ignores > 0 ? 'text-dangerText' : 'text-textDim'}`}>
                  {s.ignores}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rapport.remarques.length > 0 && (
        <Remarques remarques={rapport.remarques} nonListees={rapport.remarquesNonListees} />
      )}
    </section>
  )
}

const GENRE: Record<ImportRemarque['genre'], string> = {
  RATTACHE: 'déjà là',
  IGNORE: 'ignoré',
  REMPLACE: 'remplacé',
}

/** Les décisions à lire avant d'appliquer - les abandons d'abord, ils sont les seuls qui perdent quelque chose. */
function Remarques({ remarques, nonListees }: { remarques: ImportRemarque[]; nonListees: number }) {
  const ordonnees = [...remarques].sort((a, b) => poids(a) - poids(b))
  return (
    <details className="rounded-xl bg-surface p-4">
      <summary className="cursor-pointer text-sm font-medium text-textPrimary">
        Le détail, ligne par ligne ({remarques.length}
        {nonListees > 0 ? ` sur ${remarques.length + nonListees}` : ''})
      </summary>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm">
        {ordonnees.map((r, i) => (
          <li key={i} className="flex flex-wrap gap-x-2">
            <span
              className={`shrink-0 rounded px-1.5 text-xs leading-5 ${
                r.genre === 'IGNORE' ? 'bg-dangerTint text-dangerText' : 'bg-surface2 text-textDim'
              }`}
            >
              {GENRE[r.genre]}
            </span>
            <span className="text-textPrimary">{r.sujet}</span>
            <span className="text-textDim">— {r.detail}</span>
          </li>
        ))}
        {nonListees > 0 && <li className="text-textDim">… et {nonListees} autre(s), non listée(s).</li>}
      </ul>
    </details>
  )
}

function poids(r: ImportRemarque): number {
  return r.genre === 'IGNORE' ? 0 : r.genre === 'REMPLACE' ? 1 : 2
}
