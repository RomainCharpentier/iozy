import { AlertTriangle } from 'lucide-react'

/** Bannière d'erreur non bloquante - même esprit que le "Synchronisation
 * impossible, affichage du cache local" de l'iOS (mais ce client n'ayant
 * pas de cache offline, on affiche juste le message d'erreur). */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-pink/10 px-4 py-3 text-sm text-pink">
      <AlertTriangle size={16} className="shrink-0" />
      {message}
    </div>
  )
}
