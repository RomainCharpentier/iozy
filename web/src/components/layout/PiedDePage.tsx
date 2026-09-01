import { useQuery } from '@tanstack/react-query'
import { VERSION_INTERFACE, lireVersionServeur, versionCourte } from '../../api/version'
import { queryKeys } from '../../lib/queryKeys'

/**
 * Quelle livraison tourne - en petit, en bas de chaque page.
 *
 * <h2>Pourquoi en pied de page, et pas dans les Réglages</h2>
 * Elle y a d'abord vécu, et c'était une erreur de rangement : on ne cherche
 * pas une version, on la LIT quand on a un doute, c'est-à-dire n'importe où
 * dans l'application et sans vouloir en sortir. Un numéro de série ne se
 * range pas dans les options ; il se pose au bas de ce qu'il identifie.
 *
 * <h2>Pourquoi elle existe</h2>
 * Depuis que les mises à jour arrivent toutes seules, on ne sait plus de
 * mémoire ce qui est en ligne : on pousse, et quelque chose arrive cinq
 * minutes plus tard. Devant un comportement inattendu, la première question
 * devient « est-ce que ma correction est seulement déployée ? » - et sans
 * réponse, on cherche un défaut dans du code qui n'est pas encore là.
 *
 * <h2>Un numéro, parce qu'un numéro se compare</h2>
 * C'est le nombre de commits de `main` au moment de la publication (voir
 * .github/workflows/deploiement.yml). Devant « Version 379 » et « serveur
 * 378 », on sait sans rien ouvrir laquelle des deux images est en retard —
 * deux SHA, eux, ne se comparaient pas. Et le numéro mène au code : il
 * étiquette le commit livré (`git show version-379`) autant que l'image
 * publiée.
 *
 * <h2>« Version », et surtout pas « Livraison »</h2>
 * Le mot juste, dans le vocabulaire interne de ce dépôt, serait « livraison ».
 * Il est pris : l'analyse d'achat appelle « livraison » les FRAIS DE PORT
 * d'une annonce (« Livraison non incluse », voir docs/LISTING_SOURCES.md), et
 * ce pied de page s'affiche jusqu'au bas de cet écran-là. Un mot pour deux
 * choses sur la même page se paie toujours plus cher qu'un synonyme.
 *
 * <h2>Deux versions, mais une seule ligne quand elles s'accordent</h2>
 * L'interface et le serveur sont deux images distinctes, tirées séparément.
 * Les afficher toutes les deux en permanence donnerait deux fois la même
 * chose dans le cas normal ; ne montrer que celle du serveur mentirait dans
 * le cas qui compte - un service worker qui garde l'ancienne coquille, une
 * image sur deux qui n'a pas été tirée. La seconde n'apparaît donc QUE si
 * elle diffère, et dit alors quoi faire : un écart se répare presque toujours
 * en rechargeant.
 *
 * <h2>Muet quand il ne sait pas</h2>
 * L'appel au serveur ne réessaie pas et n'annonce aucune erreur : ne pas
 * connaître la version qui tourne n'est pas une panne, et sûrement pas une
 * bannière rouge en bas de toutes les pages. La version de l'interface, elle,
 * est toujours là - elle est compilée dans le fichier.
 */
export function PiedDePage() {
  // `staleTime: Infinity` : elle ne change qu'au redéploiement, et l'appel a
  // donc lieu une fois par session, pas à chaque changement d'écran.
  const versionServeur = useQuery({
    queryKey: queryKeys.version,
    queryFn: lireVersionServeur,
    staleTime: Infinity,
    retry: false,
  })

  const serveur = versionServeur.data?.version ?? null
  const memeLivraison = serveur !== null && serveur === VERSION_INTERFACE

  return (
    <footer className="pb-24 text-center text-xs text-textDim md:pb-10">
      Version {versionCourte(VERSION_INTERFACE)}
      {serveur !== null && !memeLivraison && (
        <>
          {' '}· serveur {versionCourte(serveur)} —{' '}
          <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2">
            recharger
          </button>
        </>
      )}
    </footer>
  )
}
