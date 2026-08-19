/**
 * Panneau "Prochaines sorties" de Découvrir (voir DS v1.1 §44). BLOCKED_BY_DATA
 * réel, pas un "bientôt disponible" vague : aucune des deux données requises
 * n'existe dans ce backend aujourd'hui - ni une date de prochaine sortie par
 * tome (aucun fournisseur branché ne l'expose - Jikan/MyAnimeList/Google
 * Books ne donnent pas de calendrier de parution fiable par tome), ni un
 * concept "suivre une série" distinct de la Wishlist. Construire cet écran
 * suppose de choisir/intégrer une vraie source de données avant tout —
 * jamais une date ou une liste de séries suivies inventée pour remplir
 * l'espace (voir §64-66 : jamais de donnée de marché ou de sortie fabriquée).
 */
export function DiscoverReleasesPanel() {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[11px] font-semibold tracking-wide text-textDim uppercase">Séries que tu suis</h2>
      <div className="rounded-2xl border border-surface2 bg-surface p-5">
        <p className="text-sm font-semibold text-textPrimary">Pas encore de calendrier de sorties.</p>
        <p className="mt-1.5 text-sm text-textDim">
          Aucune source ne fournit aujourd'hui de date fiable de prochain tome par série - cette section arrivera
          quand une vraie donnée existera, jamais avec des dates approximatives.
        </p>
      </div>
    </div>
  )
}
