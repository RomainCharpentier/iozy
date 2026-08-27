import { useState } from 'react'
import { Check } from 'lucide-react'
import { gradientFor } from '../theme/gradient'
import { TexteCoupe } from './TexteCoupe'

interface CoverTileProps {
  title: string
  /** Jaquette réelle (Jikan/Google Books/Open Library), si une correspondance
   * a été trouvée lors de l'ajout. Absente pour un ajout en saisie libre, ou
   * si la recherche de métadonnées n'a rien renvoyé - le dégradé reste alors
   * le repli, jamais une image cassée. */
  imageUrl?: string | null
  showBadge?: boolean
  /** Ligne secondaire sous le titre (ex: "17/26 tomes" en vue groupée par
   * série sur Ma collection, "Tome 3 · Perfect Edition" en vue non groupée,
   * "Possédé" pour un type sans notion de tome) - absente par défaut,
   * n'affecte pas les autres usages de ce composant (Relations). */
  subtitle?: string
  /** Petit badge de type ("Manga", "Jeu vidéo"...) sous le sous-titre - un
   * élément distinct de `subtitle`, jamais un repli l'un pour l'autre (voir
   * la refonte layout demandée : une tuile doit rester reconnaissable par
   * objet/type/état, 3 informations séparées, pas 2 qui se partagent une
   * seule ligne). Absent si le type n'est pas connu à cet endroit. */
  typeLabel?: string
  /** ex: "aspect-[2/3]" (défaut) ou "aspect-square" pour les listes horizontales. */
  aspectClassName?: string
  /** Signal prioritaire unique (voir la maquette V1.2 - "un seul signal par
   * carte, jamais empilé" : chaque source potentielle de badge choisit
   * elle-même LE signal le plus pertinent avant de le passer ici, ce
   * composant ne fait qu'afficher ce qu'on lui donne, jamais d'empilement
   * de plusieurs signaux indépendants). */
  signal?: string
  /** Clé utilisée pour le dégradé de repli (voir gradientFor) - `title` par
   * défaut. À surcharger quand plusieurs tuiles partagent le même titre mais
   * doivent rester visuellement distinctes sans jaquette réelle (ex: les
   * tomes d'une même série en vue non groupée - voir `aplatirEnTomes`, qui y
   * ajoute le sous-titre "Tome N" pour ne pas afficher le même dégradé sur
   * chaque tome faute de jaquette propre au tome). */
  gradientKey?: string
  onClick?: () => void
}

/**
 * Jaquette réelle quand une source externe en a fourni une (Jikan / Google
 * Books via scan ISBN / Open Library), avec le dégradé déterministe (calculé
 * depuis le titre) comme repli - saisie libre, échec de recherche, ou simple
 * échec de chargement de l'image.
 * <p>
 * Cadre image et métadonnées SÉPARÉS (voir la refonte layout demandée) :
 * plus de titre/sous-titre en overlay sur la jaquette (lisible seulement
 * grâce à un dégradé sombre par-dessus l'image, qui l'assombrissait pour
 * rien) - le texte vit maintenant sous l'image, en texte normal. Seule
 * exception : le petit badge "possédé" (`showBadge`), qui reste par nature
 * une info attachée à la jaquette elle-même. Miroir de CoverTile.swift
 * (à réconcilier séparément si besoin, hors périmètre ici).
 */
export function CoverTile({
  title,
  imageUrl,
  showBadge = false,
  subtitle,
  typeLabel,
  aspectClassName = 'aspect-[2/3]',
  gradientKey,
  signal,
  onClick,
}: CoverTileProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = !!imageUrl && !imageFailed

  return (
    <button type="button" onClick={onClick} className={`flex w-full min-w-0 flex-col text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <div
        className={`relative w-full overflow-hidden rounded-2xl ${aspectClassName}`}
        style={showImage ? undefined : { background: gradientFor(gradientKey ?? title) }}
      >
        {showImage && (
          <img
            src={imageUrl}
            alt=""
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {showBadge && (
          <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accentInk">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
      </div>
      {/* Espacement littéral demandé : cadre -> 8px -> titre -> 4px ->
          sous-titre -> 6px -> badge de type. */}
      <div className="mt-2 flex min-w-0 flex-col">
        <TexteCoupe texte={title} className="line-clamp-2 text-sm font-semibold text-textPrimary" />
        {subtitle && <TexteCoupe texte={subtitle} className="mt-1 line-clamp-1 text-xs text-textDim" />}
        {typeLabel && (
          <span className="mt-1.5 w-fit rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-textDim">
            {typeLabel}
          </span>
        )}
        {signal && (
          <span className="mt-1.5 w-fit rounded-full bg-accentTint px-2 py-0.5 text-[10px] font-semibold text-accentText">
            {signal}
          </span>
        )}
      </div>
    </button>
  )
}
