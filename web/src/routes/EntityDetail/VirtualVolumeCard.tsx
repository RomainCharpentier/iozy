import { PastilleJeLAi, TuileTome } from './TuileTome'

/**
 * Tome sans aucune donnée catalogue (numéro déduit du nombre total de tomes
 * connu de l'édition, voir TomesGridSection.buildTiles) - un vrai emplacement
 * visuel, pas un rectangle avec un numéro nu : l'utilisateur doit comprendre
 * « cette place correspond au tome que je ne possède pas encore », jamais
 * « cette donnée est absente de la base ». Aucun vocabulaire technique affiché
 * (jamais « virtuel »/« non catalogué »/« Variant » - ces notions restent des
 * détails d'implémentation, voir TomeTile.status).
 * <p>
 * Composant dédié plutôt qu'une branche de plus dans TomeTileView, mais tous
 * deux passent désormais par la MÊME TuileTome : un tome manquant catalogué et
 * un tome manquant purement virtuel ont exactement les mêmes dimensions, la
 * même légende et le même « Je l'ai » - seule diffère la présence d'une vraie
 * jaquette à atténuer. C'est ce qui garantit qu'une rangée reste alignée quel
 * que soit ce que le catalogue connaît.
 */
export function VirtualVolumeCard({
  volumeNumber,
  isActive,
  onClick,
}: {
  volumeNumber: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <TuileTome numero={volumeNumber} etat="missing" isActive={isActive} onClick={onClick}>
      <span className="font-display text-2xl font-bold text-handle">
        {String(volumeNumber).padStart(2, '0')}
      </span>
      <PastilleJeLAi />
    </TuileTome>
  )
}
