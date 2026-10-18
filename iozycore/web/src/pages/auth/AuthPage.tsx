import { useState, type FormEvent } from 'react'
import { ErrorBanner } from '@/common/components/ErrorBanner'
import { CLASSE_CARTE } from '@/common/components/Carte'
import { AppSwitcher } from '@/common/components/layout/AppSwitcher'
import { PiedDePage } from '@/common/components/layout/PiedDePage'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * The gate, screen side.
 *
 * <h2>One screen, three situations</h2>
 * A new instance has no account: it offers to <b>create the
 * first one</b>, which will take over the collection already in the database. An instance in
 * service offers to <b>sign in</b>, and only opens creation if
 * the operator has configured an invitation code. Three separate screens
 * would have the same error to show three times.
 *
 * <h2>What is not said</h2>
 * A sign-in refusal says "adresse ou mot de passe incorrect" and nothing
 * more: the server decides this, and it deliberately returns the same
 * message in both cases - telling them apart would offer an account existence
 * test to someone who has none.
 *
 * <h2>And a fourth way out, always open</h2>
 * "Visiter sans compte" leads to the <b>catalog</b>: the works the instance
 * knows, read-only. Nothing that anyone owns, rates or
 * wishes for - this data belongs to accounts, and a visitor is not
 * one. No setting conditions this button: there is nothing to authorize.
 *
 * <p>Outside {@code AppShell}: someone who is not signed in must see
 * neither the navigation, nor any collection counter.
 */
export function AuthPage() {
  const { aucunCompteSurLInstance, creationOuverte, connexion, creation, visite } = useAuth()
  const [mode, setMode] = useState<'connexion' | 'creation' | null>(null)
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [codeInvitation, setCodeInvitation] = useState('')

  // The default mode follows the instance; an explicit click replaces it.
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
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 px-4 py-10">
      {/* A glow of accent at the top, nothing else: the gate is the first
          screen that is seen, it must look like the application, not like a
          form placed on an empty page. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(70%_60%_at_50%_0%,var(--color-accentTint),transparent_70%)]"
      />
      {/* The same bar as on every page of the site: the brand and its menu on
          the left, the account link on the right - here "Connexion" is the
          page itself, so it is marked current and leads nowhere else. */}
      <header className="flex h-12 items-center">
        <AppSwitcher compact />
        <a href={import.meta.env.BASE_URL} aria-current="page" className="iozy-compte ml-auto">
          Connexion
        </a>
      </header>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em] text-textPrimary">
          Iozy<span className="text-accent">Core</span>
        </h1>
        <p className="text-[15px] leading-relaxed text-textDim">
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
            className="champ"
          />
        </label>

        {/* Same structure as the username: the minimum length is a
            DESCRIPTION, not a part of the field name. In the label, it
            made "Mot de passe Au moins 10 caractères" be announced as one
            single title - and made the field impossible to find under its name. */}
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5 text-sm text-textDim" htmlFor="auth-mot-de-passe">
            Mot de passe
            <input
              id="auth-mot-de-passe"
              type="password"
              // Tells the password manager whether it should offer to
              // make one up or to read again the one it already has.
              autoComplete={enCreation ? 'new-password' : 'current-password'}
              required
              minLength={enCreation ? 10 : undefined}
              aria-describedby={enCreation ? 'auth-mot-de-passe-regle' : undefined}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="champ"
            />
          </label>
          {enCreation && (
            <span id="auth-mot-de-passe-regle" className="text-xs text-textDim">
              Au moins 10 caractères.
            </span>
          )}
        </div>

        {enCreation && (
          // The rule lives OUTSIDE the label, linked by `aria-describedby`: inside the
          // label, it would be part of the field NAME, which a screen reader
          // then announces in one go ("Pseudo 3 à 24 caractères sans
          // espace c'est le nom…") instead of naming it and then describing it.
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
                className="champ"
              />
            </label>
            {/* The rule is written BEFORE typing, not returned as a refusal after:
                the server stays the only judge (it knows the usernames already taken),
                but nothing forces the user to find the limits by trial. */}
            <span id="auth-pseudo-regle" className="text-xs text-textDim">
              3 à 24 caractères, sans espace. C’est le nom sous lequel tu apparais.
            </span>
          </div>
        )}

        {/* The invitation code concerns ONLY the following accounts: the
            first one does not need it, and showing it then would suggest
            that one is needed. */}
        {enCreation && !aucunCompteSurLInstance && (
          <label className="flex flex-col gap-1.5 text-sm text-textDim" htmlFor="auth-invitation">
            Code d’invitation
            <input
              id="auth-invitation"
              required
              value={codeInvitation}
              onChange={(e) => setCodeInvitation(e.target.value)}
              className="champ"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={enCours}
          className="btn-primaire"
        >
          {enCours ? 'Un instant…' : enCreation ? 'Créer mon compte' : 'Se connecter'}
        </button>

        {echec && <ErrorBanner message={echec.message} />}
      </form>

      {/* Switch offered only when it leads somewhere: on an
          instance closed to new accounts, "créer un compte" would only open
          a refusal. */}
      {!aucunCompteSurLInstance && creationOuverte && (
        <button
          type="button"
          onClick={() => setMode(enCreation ? 'connexion' : 'creation')}
          className="flex min-h-11 items-center self-center text-sm text-accentText underline underline-offset-4"
        >
          {enCreation ? 'J’ai déjà un compte' : 'Créer un compte avec une invitation'}
        </button>
      )}

      {/* Always offered, without condition: there is nothing to authorize, and the
          catalog belongs to nobody. Outside the form, because
          it is not a variant of it - it is giving up on identifying oneself. */}
      <div className="flex flex-col items-center gap-1.5 border-t border-white/5 pt-5">
          <button
            type="button"
            onClick={() => visite.mutate()}
            disabled={enCours}
            className="btn-secondaire"
          >
            {visite.isPending ? 'Un instant…' : 'Visiter sans compte'}
          </button>
        <p className="text-center text-xs text-textDim">
          Tu consultes le catalogue des œuvres, en lecture seule.
        </p>
      </div>
      {/* Which delivery is running - here more than elsewhere: when one does not
          enter, the first question is to know what is online. */}
      <PiedDePage sansSession />
    </main>
  )
}
