import { useState, type FormEvent } from 'react'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { PiedDePage } from '@/common/components/layout/PiedDePage'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * La porte, côté écran.
 *
 * <h2>Un seul écran, trois situations</h2>
 * Une instance neuve n'a aucun compte : elle propose d'en <b>créer le
 * premier</b>, qui reprendra la collection déjà en base. Une instance en
 * service propose de <b>se connecter</b>, et n'ouvre la création que si
 * l'exploitant a configuré un code d'invitation. Trois écrans séparés
 * auraient trois fois la même erreur à afficher.
 *
 * <h2>Ce qui n'est pas dit</h2>
 * Un refus de connexion dit « adresse ou mot de passe incorrect » et rien de
 * plus : c'est le serveur qui en décide, et il rend volontairement le même
 * message dans les deux cas - distinguer offrirait un test d'existence de
 * compte à qui n'en a pas.
 *
 * <h2>Et une quatrième issue, toujours ouverte</h2>
 * « Visiter sans compte » mène au <b>catalogue</b> : les œuvres que l'instance
 * connaît, en lecture seule. Rien de ce que quiconque possède, note ou
 * souhaite - ces données appartiennent à des comptes, et un visiteur n'en est
 * pas un. Aucun réglage ne conditionne ce bouton : il n'y a rien à autoriser.
 *
 * <p>Hors de {@code AppShell} : quelqu'un qui n'est pas connecté ne doit voir
 * ni la navigation, ni le moindre compteur de collection.
 */
export function AuthPage() {
  const { aucunCompteSurLInstance, creationOuverte, connexion, creation, visite } = useAuth()
  const [mode, setMode] = useState<'connexion' | 'creation' | null>(null)
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [codeInvitation, setCodeInvitation] = useState('')

  // Le mode par défaut suit l'instance ; un clic explicite le remplace.
  const modeCourant = mode ?? (aucunCompteSurLInstance ? 'creation' : 'connexion')
  const enCreation = modeCourant === 'creation'
  const enCours = connexion.isPending || creation.isPending || visite.isPending
  const echec = connexion.error ?? creation.error ?? visite.error

  function envoyer(evenement: FormEvent) {
    evenement.preventDefault()
    if (enCreation) {
      creation.mutate({
        email: email.trim(),
        motDePasse,
        pseudo: pseudo.trim(),
        codeInvitation: codeInvitation.trim() || undefined,
      })
    } else {
      connexion.mutate({ email: email.trim(), motDePasse })
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-2xl font-bold text-textPrimary">IozyCore</h1>
        <p className="text-sm text-textDim">
          {aucunCompteSurLInstance
            ? 'Personne n’a encore de compte ici. Le premier créé reprend la collection déjà enregistrée.'
            : 'Ta collection, ce qu’il te manque, et ce que vaut une annonce.'}
        </p>
      </div>

      <form onSubmit={envoyer} className={`flex flex-col gap-3 ${CLASSE_CARTE}`}>
        <h2 className="font-display text-lg font-bold text-textPrimary">
          {enCreation ? 'Créer un compte' : 'Se connecter'}
        </h2>

        <label className="flex flex-col gap-1.5 text-sm text-textDim" htmlFor="auth-email">
          Adresse e-mail
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
          />
        </label>

        {/* Même structure que le pseudo : la longueur minimale est une
            DESCRIPTION, pas une partie du nom du champ. Dans le label, elle
            faisait annoncer « Mot de passe Au moins 10 caractères » comme un
            seul intitulé - et rendait le champ introuvable sous son nom. */}
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5 text-sm text-textDim" htmlFor="auth-mot-de-passe">
            Mot de passe
            <input
              id="auth-mot-de-passe"
              type="password"
              // Dit au gestionnaire de mots de passe s'il doit proposer d'en
              // fabriquer un ou de relire celui qu'il a déjà.
              autoComplete={enCreation ? 'new-password' : 'current-password'}
              required
              minLength={enCreation ? 10 : undefined}
              aria-describedby={enCreation ? 'auth-mot-de-passe-regle' : undefined}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
            />
          </label>
          {enCreation && (
            <span id="auth-mot-de-passe-regle" className="text-xs text-textDim">
              Au moins 10 caractères.
            </span>
          )}
        </div>

        {enCreation && (
          // La règle vit HORS du label, reliée par `aria-describedby` : dans le
          // label, elle ferait partie du NOM du champ, qu'un lecteur d'écran
          // annonce alors d'une traite (« Pseudo 3 à 24 caractères sans
          // espace c'est le nom… ») au lieu de le nommer puis de le décrire.
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5 text-sm text-textDim" htmlFor="auth-pseudo">
              Pseudo
              <input
                id="auth-pseudo"
                autoComplete="nickname"
                required
                minLength={3}
                maxLength={24}
                aria-describedby="auth-pseudo-regle"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
              />
            </label>
            {/* La règle est écrite AVANT la saisie, pas rendue en refus après :
                le serveur reste seul juge (il connaît les pseudos déjà pris),
                mais rien n'oblige à laisser découvrir les bornes par essais. */}
            <span id="auth-pseudo-regle" className="text-xs text-textDim">
              3 à 24 caractères, sans espace. C’est le nom sous lequel tu apparais.
            </span>
          </div>
        )}

        {/* Le code d'invitation ne concerne QUE les comptes suivants : le
            premier n'en a pas besoin, et l'afficher alors laisserait croire
            qu'il en faut un. */}
        {enCreation && !aucunCompteSurLInstance && (
          <label className="flex flex-col gap-1.5 text-sm text-textDim" htmlFor="auth-invitation">
            Code d’invitation
            <input
              id="auth-invitation"
              required
              value={codeInvitation}
              onChange={(e) => setCodeInvitation(e.target.value)}
              className="rounded-lg bg-surface2 px-3 py-2 text-sm text-textPrimary placeholder:text-textDim focus:ring-2 focus:ring-accent/50 focus:outline-none"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={enCours}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accentInk disabled:opacity-50"
        >
          {enCours ? 'Un instant…' : enCreation ? 'Créer mon compte' : 'Se connecter'}
        </button>

        {echec && <ErrorBanner message={echec.message} />}
      </form>

      {/* Bascule proposée seulement quand elle mène quelque part : sur une
          instance fermée aux nouveaux comptes, « créer un compte » n'ouvrirait
          qu'un refus. */}
      {!aucunCompteSurLInstance && creationOuverte && (
        <button
          type="button"
          onClick={() => setMode(enCreation ? 'connexion' : 'creation')}
          className="self-center text-sm text-accentText underline underline-offset-4"
        >
          {enCreation ? 'J’ai déjà un compte' : 'Créer un compte avec une invitation'}
        </button>
      )}

      {/* Toujours proposé, sans condition : il n'y a rien à autoriser, et le
          catalogue n'appartient à personne. En dehors du formulaire, parce que
          ce n'en est pas une variante - c'est renoncer à s'identifier. */}
      <div className="flex flex-col items-center gap-1.5 border-t border-white/5 pt-5">
          <button
            type="button"
            onClick={() => visite.mutate()}
            disabled={enCours}
            className="min-h-11 rounded-xl bg-surface2 px-4 text-sm font-semibold text-textPrimary disabled:opacity-50"
          >
            {visite.isPending ? 'Un instant…' : 'Visiter sans compte'}
          </button>
        <p className="text-center text-xs text-textDim">
          Tu consultes le catalogue des œuvres, en lecture seule.
        </p>
      </div>
      {/* Quelle livraison tourne - ici plus qu'ailleurs : quand on n'entre
          pas, la première question est de savoir ce qui est en ligne. */}
      <PiedDePage sansSession />
    </main>
  )
}
