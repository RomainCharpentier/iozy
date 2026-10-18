import { AlertTriangle } from 'lucide-react'

/** Non-blocking error banner - same spirit as the "Synchronisation
 * impossible, affichage du cache local" of iOS (but since this client has
 * no offline cache, we just display the error message). */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-dangerTint px-4 py-3 text-sm text-dangerText">
      <AlertTriangle size={16} className="shrink-0" />
      {message}
    </div>
  )
}
