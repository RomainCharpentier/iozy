/**
 * <b>What the service worker refuses to touch.</b>
 *
 * The rule that matters here is not what it caches, it is what it lets
 * through: an API response served from a cache would be an outdated
 * collection presented as the real one - the opposite of the rest of the
 * app, which never displays a figure that it does not believe.
 *
 * <p>Nothing here can be seen on the screen: a failed sort breaks no
 * rendering, it simply serves old data, and all the more quietly as the
 * cache fills up over time.
 *
 * <p>The manifest and its icons are checked elsewhere - `npm run check:pwa`,
 * which reads the files of `public/` (see `scripts/check-pwa.mjs`).
 */
import { beforeAll, describe, expect, it } from 'vitest'

describe('the service worker', () => {
  beforeAll(async () => {
    // The file runs as it is: it sets its listeners on `self` (here the
    // jsdom window, which is harmless) and exposes its sorting decision there.
    // @ts-expect-error - served as it is from public/, without type declarations
    await import('../public/sw.js')
  })

  const strategie = (url: string, methode = 'GET') =>
    (self as unknown as { strategiePour: (u: URL, m?: string) => string }).strategiePour(
      new URL(url, self.location.origin),
      methode,
    )

  it('NEVER touches the data of the user', () => {
    expect(strategie('/api/entities/search?q=berserk')).toBe('ignorer')
    expect(strategie('/api/wishlist')).toBe('ignorer')
    expect(strategie('/api')).toBe('ignorer')
  })

  it('is not fooled by a route that starts the same way', () => {
    // `/apercu` is not `/api`: the sorting is done on a whole segment.
    expect(strategie('/apercu')).toBe('reseau-dabord')
  })

  it('lets every write through, without exception', () => {
    expect(strategie('/', 'POST')).toBe('ignorer')
    expect(strategie('/assets/index-abc123.js', 'DELETE')).toBe('ignorer')
  })

  it('ignores what is not served by the app itself', () => {
    expect(strategie('https://cdn.myanimelist.net/images/1.jpg')).toBe('ignorer')
  })

  it('serves the cache first for a file with a fingerprinted name', () => {
    // `/assets/…-abc123.js` will never change content: asking the network
    // first would cost a round trip to receive exactly the same thing.
    expect(strategie('/assets/index-CoRMhSte.js')).toBe('cache-dabord')
    expect(strategie('/assets/index-xyz.css')).toBe('cache-dabord')
  })

  it('serves the network first for everything else', () => {
    // This is what makes a deployment visible at the next visit, and not at
    // the one after.
    expect(strategie('/')).toBe('reseau-dabord')
    expect(strategie('/entity/berserk')).toBe('reseau-dabord')
    expect(strategie('/manifest.webmanifest')).toBe('reseau-dabord')
    expect(strategie('/icon-192.png')).toBe('reseau-dabord')
  })
})
