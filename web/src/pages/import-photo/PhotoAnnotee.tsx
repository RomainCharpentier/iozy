import type { BoxDto } from '@/common/types/listingRecognition'

/**
 * La photo, avec un cadre là où le moteur a vu chaque livre.
 *
 * Chaque cadre est la pastille du tome, posée sur la photo : même état
 * (coché, décoché, déjà possédé, numéro non lu), même geste - un clic coche
 * ou décoche. C'est ce qui permet de vérifier une lecture sans quitter
 * l'image : « T62 » écrit sur le cadre du 62e livre, ou sur le 61e.
 */
export type EtatCadre = 'coche' | 'decoche' | 'possede' | 'sansNumero'

export interface Cadre {
  cle: string
  /** « T62 », ou « ? » quand le numéro n'a pas été lu. */
  libelle: string
  titre: string
  etat: EtatCadre
  box: BoxDto
  /** Ce que le lecteur a vu là (« Chiffre 62 sur la tranche »). */
  indice?: string
}

const BORDURE: Record<EtatCadre, string> = {
  coche: 'border-accent bg-accent/25',
  decoche: 'border-dashed border-textDim/70',
  possede: 'border-ok bg-okTint/60',
  sansNumero: 'border-dashed border-warning bg-warningTint/40',
}

const PASTILLE: Record<EtatCadre, string> = {
  coche: 'bg-accent text-accentInk',
  decoche: 'bg-surface text-textDim',
  possede: 'bg-okTint text-ok',
  sansNumero: 'bg-warning text-warningInk',
}

/**
 * Une tranche est un rectangle bien plus haut que large : son étiquette se
 * lit alors de haut en bas, comme le titre imprimé dessus - à l'horizontale,
 * « T62 » n'y tiendrait pas. Le rapport est calculé en pixels de la photo ;
 * tant qu'elle n'est pas chargée, une photo de téléphone en paysage sert
 * d'estimation.
 */
function etiquetteVerticale(box: BoxDto, taille?: { w: number; h: number }): boolean {
  const w = taille?.w ?? 16
  const h = taille?.h ?? 9
  const hauteur = (box.bottom - box.top) * h
  const largeur = (box.right - box.left) * w
  return largeur > 0 && hauteur / largeur > 2.2
}

export function PhotoAnnotee({
  src,
  numero,
  cadres,
  enCours,
  taille,
  onBasculer,
  onTaille,
}: {
  /** L'URL locale de la photo - vide quand le navigateur ne sait pas en fabriquer une. */
  src: string
  /** Le numéro de la photo tel que l'utilisateur la compte : 1, 2, 3. */
  numero: number
  cadres: Cadre[]
  /** Le cadre en cours de validation un par un, mis en évidence. */
  enCours?: string
  /** Les dimensions de la photo, une fois chargée - pour orienter les étiquettes. */
  taille?: { w: number; h: number }
  onBasculer: (cadre: Cadre) => void
  onTaille?: (taille: { w: number; h: number }) => void
}) {
  return (
    <figure className="relative overflow-hidden rounded-xl bg-surface2">
      {src ? (
        <img
          src={src}
          alt={`Photo ${numero}`}
          className="block w-full"
          onLoad={(e) => onTaille?.({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      ) : (
        <div className="aspect-video w-full" aria-hidden="true" />
      )}
      {cadres.map((cadre) => {
        const possede = cadre.etat === 'possede'
        return (
          <button
            key={cadre.cle}
            type="button"
            role="checkbox"
            aria-checked={cadre.etat === 'coche' || possede}
            disabled={possede}
            aria-label={`${cadre.libelle} de ${cadre.titre} sur la photo ${numero}${possede ? ', déjà possédé' : ''}`}
            title={cadre.indice}
            onClick={() => onBasculer(cadre)}
            style={{
              left: `${cadre.box.left * 100}%`,
              top: `${cadre.box.top * 100}%`,
              width: `${(cadre.box.right - cadre.box.left) * 100}%`,
              height: `${(cadre.box.bottom - cadre.box.top) * 100}%`,
            }}
            className={`absolute rounded border-2 ${BORDURE[cadre.etat]} ${
              enCours === cadre.cle ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface2' : ''
            }`}
          >
            <span
              className={`absolute left-0 top-0 whitespace-nowrap font-semibold ${PASTILLE[cadre.etat]} ${
                etiquetteVerticale(cadre.box, taille)
                  ? 'rounded-b [writing-mode:vertical-rl] px-px py-1 text-[9px] leading-none'
                  : 'rounded-br px-1 text-[10px] leading-4'
              }`}
            >
              {cadre.libelle}
            </span>
          </button>
        )
      })}
      <figcaption className="sr-only">
        Photo {numero} : {cadres.length} {cadres.length > 1 ? 'cadres' : 'cadre'}
      </figcaption>
    </figure>
  )
}
