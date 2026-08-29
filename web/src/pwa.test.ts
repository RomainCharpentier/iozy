/**
 * <b>Ce que le service worker refuse de toucher.</b>
 *
 * La règle qui compte ici n'est pas ce qu'il met en cache, c'est ce qu'il
 * laisse passer : une réponse d'API servie depuis un cache serait une
 * collection périmée présentée comme la vraie - l'inverse de tout le reste de
 * l'app, qui n'affiche jamais un chiffre auquel elle ne croit pas.
 *
 * <p>Rien ici ne s'aperçoit à l'écran : un tri raté ne casse aucun rendu, il
 * sert simplement de vieilles données, et d'autant plus discrètement que le
 * cache se remplit avec le temps.
 *
 * <p>Le manifeste et ses icônes se vérifient ailleurs - `npm run check:pwa`,
 * qui lit les fichiers de `public/` (voir `scripts/check-pwa.mjs`).
 */
import { beforeAll, describe, expect, it } from 'vitest'

describe('le service worker', () => {
  beforeAll(async () => {
    // Le fichier s'exécute tel quel : il pose ses écouteurs sur `self` (ici la
    // fenêtre de jsdom, ce qui est inoffensif) et y expose sa décision de tri.
    // @ts-expect-error - servi tel quel depuis public/, sans déclaration de types
    await import('../public/sw.js')
  })

  const strategie = (url: string, methode = 'GET') =>
    (self as unknown as { strategiePour: (u: URL, m?: string) => string }).strategiePour(
      new URL(url, self.location.origin),
      methode,
    )

  it('ne touche JAMAIS aux données de l’utilisateur', () => {
    expect(strategie('/api/entities/search?q=berserk')).toBe('ignorer')
    expect(strategie('/api/wishlist')).toBe('ignorer')
    expect(strategie('/api')).toBe('ignorer')
  })

  it('ne se laisse pas berner par une route qui commence pareil', () => {
    // `/apercu` n'est pas `/api` : le tri se fait sur un segment entier.
    expect(strategie('/apercu')).toBe('reseau-dabord')
  })

  it('laisse passer toute écriture, sans exception', () => {
    expect(strategie('/', 'POST')).toBe('ignorer')
    expect(strategie('/assets/index-abc123.js', 'DELETE')).toBe('ignorer')
  })

  it('ignore ce qui n’est pas servi par l’app elle-même', () => {
    expect(strategie('https://cdn.myanimelist.net/images/1.jpg')).toBe('ignorer')
  })

  it('sert d’abord le cache pour un fichier au nom empreinté', () => {
    // `/assets/…-abc123.js` ne changera jamais de contenu : demander le réseau
    // d'abord coûterait un aller-retour pour recevoir exactement la même chose.
    expect(strategie('/assets/index-CoRMhSte.js')).toBe('cache-dabord')
    expect(strategie('/assets/index-xyz.css')).toBe('cache-dabord')
  })

  it('sert d’abord le réseau pour tout le reste', () => {
    // C'est ce qui fait qu'un déploiement est visible à la visite suivante, et
    // pas à celle d'après.
    expect(strategie('/')).toBe('reseau-dabord')
    expect(strategie('/entity/berserk')).toBe('reseau-dabord')
    expect(strategie('/manifest.webmanifest')).toBe('reseau-dabord')
    expect(strategie('/icon-192.png')).toBe('reseau-dabord')
  })
})
