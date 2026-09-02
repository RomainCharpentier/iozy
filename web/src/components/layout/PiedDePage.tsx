import { useQuery } from '@tanstack/react-query'
import { VERSION_INTERFACE, estUneLivraison, lireVersionServeur, versionCourte } from '../../api/version'
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
 * Majeure.Mineure.Patch, déduit des messages de commit à la publication (voir
 * web/scripts/version.mjs). Devant « Version 1.3.1 » et « serveur 1.2.0 », on
 * sait sans rien ouvrir laquelle des deux images est en retard — deux SHA, eux,
 * ne se comparaient pas — et de quelle nature était l'écart. Le numéro mène au
 * code : il étiquette le commit livré (`git show v1.3.1`) autant que l'image
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
 * <h2>À la porte aussi, et c'est là qu'il sert le plus</h2>
 * L'écran de connexion vit HORS du shell (voir `PorteFermee` dans App.tsx) :
 * il n'avait donc pas de pied de page, et c'était l'écran où la question se
 * pose le plus fort - quand on n'entre pas, on veut d'abord savoir ce qui
 * tourne. `sansSession` l'y rend possible : le numéro de l'interface est
 * compilé dans le fichier, il ne demande rien à personne. Celui du serveur,
 * lui, n'est pas demandé - la route exige une session, et un 401 de plus dans
 * la console n'apprendrait rien à qui lit déjà « Version 379 ».
 *
 * <h2>Deux brouillons ne divergent pas</h2>
 * Sur un poste de travail, l'interface porte `1.1.0-dev` (dérivé des commits
 * par vite.config.ts) et l'API répond `dev` : deux valeurs différentes, mais aucun
 * écart à réparer - ce sont deux constructions locales, elles n'ont aucune
 * raison de coïncider. Annoncer « serveur dev, rechargez » à chaque écran
 * apprendrait à ignorer la ligne qui compte le jour où l'écart est vrai.
 * L'écart n'est donc signalé qu'entre deux LIVRAISONS.
 *
 * <h2>Muet quand il ne sait pas</h2>
 * L'appel au serveur ne réessaie pas et n'annonce aucune erreur : ne pas
 * connaître la version qui tourne n'est pas une panne, et sûrement pas une
 * bannière rouge en bas de toutes les pages. La version de l'interface, elle,
 * est toujours là - elle est compilée dans le fichier.
 */
export function PiedDePage({ sansSession = false }: { sansSession?: boolean } = {}) {
  // `staleTime: Infinity` : elle ne change qu'au redéploiement, et l'appel a
  // donc lieu une fois par session, pas à chaque changement d'écran.
  const versionServeur = useQuery({
    queryKey: queryKeys.version,
    queryFn: lireVersionServeur,
    staleTime: Infinity,
    retry: false,
    enabled: !sansSession,
  })

  const serveur = versionServeur.data?.version ?? null
  const ecartReel =
    serveur !== null &&
    serveur !== VERSION_INTERFACE &&
    estUneLivraison(serveur) &&
    estUneLivraison(VERSION_INTERFACE)

  return (
    // Le dégagement du bas n'existe que pour la barre d'onglets fixe, qui
    // appartient au shell : à la porte, il ne dégagerait rien et remonterait
    // le formulaire centré de 96 px.
    <footer
      className={
        sansSession ? 'text-center text-xs text-textDim' : 'pb-24 text-center text-xs text-textDim md:pb-10'
      }
    >
      Version {versionCourte(VERSION_INTERFACE)}
      {ecartReel && (
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
