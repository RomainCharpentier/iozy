import type { VariantDto } from '../types/api'

/**
 * Ce qu'on lit sur un tome, et comment.
 *
 * <h2>Pourquoi un module pour deux lignes</h2>
 * Les attributs d'un Variant sont un sac non typé (voir EntityInfoSection) :
 * chaque lecteur doit donc décider lui-même ce qu'il accepte. Ils étaient
 * quatre à réécrire la même expression pour l'édition, et quatre pour le
 * numéro - avec des règles qui avaient déjà divergé : l'assistant acceptait un
 * numéro écrit en TEXTE (`"12"`), la grille non. Un tome ainsi saisi aurait été
 * compté d'un côté et invisible de l'autre.
 *
 * <p>Une seule règle, ici, et les écarts délibérés (la comparaison sans casse
 * du rattrapage de jaquettes) deviennent visibles sur la ligne d'appel plutôt
 * que noyés dans une copie qui ressemble aux autres.
 */

/**
 * Le nom de l'édition d'un tome, tel qu'il sert de CLÉ : découpé aux
 * extrémités, `''` quand aucune n'est précisée.
 *
 * <p>La casse est conservée : c'est ce nom qui s'affiche, et c'est lui que le
 * serveur renvoie dans `sourceEditions` (voir CollectionProgressService). Un
 * appelant qui compare à une source EXTERNE - où « Kana » et « KANA » désignent
 * la même édition - abaisse la casse lui-même, explicitement.
 */
export function editionDe(variant: Pick<VariantDto, 'attributes'>): string {
  return typeof variant.attributes.edition === 'string' ? variant.attributes.edition.trim() : ''
}

/**
 * Le numéro d'un tome, ou `null` s'il n'en a pas d'exploitable.
 *
 * <p>`typeof === 'number'` STRICT, comme partout ailleurs dans l'app (voir
 * `lib/seriesInfo.totalVolumesFrom` et les NUMERIC_KEYS d'EntityInfoSection,
 * qui préservent le type à l'écriture précisément pour ça). Accepter `"12"`
 * ici reviendrait à tolérer une donnée que les écrivains s'interdisent de
 * produire, et à faire diverger deux écrans sur le même tome.
 */
export function numeroDe(variant: Pick<VariantDto, 'attributes'>): number | null {
  return typeof variant.attributes.volumeNumber === 'number' ? variant.attributes.volumeNumber : null
}

/** "Tome 12" si un numéro est exploitable, sinon le libellé brut - même règle
 *  que le sous-titre d'une tuile de Ma collection, gardée cohérente ici. */
export function variantLabel(variant: VariantDto): string {
  const numero = numeroDe(variant)
  return numero !== null ? `Tome ${numero}` : variant.label
}
