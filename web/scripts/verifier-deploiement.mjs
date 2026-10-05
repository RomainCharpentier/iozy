/**
 * Checks that a deployment **keeps its promises**, from the outside.
 *
 * Usage: `node scripts/verifier-deploiement.mjs https://iozycore.vercel.app`
 *
 * ## What it catches, and why it cannot be seen otherwise
 * All the errors checked here produce an app that **looks like it works**:
 *
 * - the `/api/*` rewrite misspelled in `vercel.json`: the login screen is
 *   still displayed, it just waits for an answer that never comes;
 * - the door wide open (one `permitAll` too many): nobody complains,
 *   everybody sees everything;
 * - the share link that answers 401 instead of 404: this is the real defect
 *   found in Batch 94 (the internal error redirect went through the security
 *   chain again), and it could only be seen on a real server;
 * - the manifest served as `application/json`: the installation prompt
 *   disappears, without a message;
 * - `sw.js` cached by the CDN: visitors stay on the old version, sometimes
 *   for days.
 *
 * `check-pwa.mjs` checks the same files **on the disk**; this one checks what
 * the server does with them. Both are needed: the second cannot run before an
 * address exists.
 *
 * ## It creates nothing, and needs no account
 * Only GETs on open routes or routes that are supposed to refuse. It can
 * therefore be run on a real deployment, at any time, leaving nothing there.
 */

const adresse = process.argv[2]
if (!adresse) {
  console.error('Usage: node scripts/verifier-deploiement.mjs <app-url>')
  console.error('Example: node scripts/verifier-deploiement.mjs https://iozycore.vercel.app')
  process.exit(2)
}

const base = adresse.replace(/\/+$/, '')
const problemes = []
const reussites = []

function verifier(condition, message, detail) {
  if (condition) reussites.push(message)
  else problemes.push(detail ? `${message} — ${detail}` : message)
}

/** Never follow a redirect: a 30x on these routes IS the defect to see. */
async function demander(chemin) {
  return fetch(`${base}${chemin}`, { redirect: 'manual', headers: { Accept: '*/*' } })
}

// --- 1. The /api/* rewrite really reaches the API
//
//     `/api/auth/etat` is one of the three open routes: it answers without an
//     account, and its body proves that Spring really answered and not the
//     home page returned by the SPA fallback (the classic trap of a missing
//     rewrite: 200, some HTML, and everything looks normal).
try {
  const etat = await demander('/api/auth/etat')
  verifier(etat.status === 200, '/api/auth/etat answers 200', `received ${etat.status}`)
  const type = etat.headers.get('content-type') ?? ''
  verifier(type.includes('application/json'), '/api/auth/etat answers JSON', `content-type: ${type || 'absent'}`)
  if (type.includes('application/json')) {
    const corps = await etat.json()
    verifier(
      typeof corps.aucunCompte === 'boolean' && typeof corps.creationOuverte === 'boolean',
      'the authentication state has the expected shape',
      `received ${JSON.stringify(corps)}`,
    )
  }
} catch (cause) {
  problemes.push(`/api/auth/etat unreachable — ${cause.message}`)
}

// --- 2. The door is closed
//
//     401 and not 200 (someone's collection is not read without a session),
//     but not 404 either: a 404 here would mean that the rewrite does not
//     cover all the routes, and the defect would only be seen once logged
//     in.
try {
  const protegee = await demander('/api/entities/search')
  verifier(protegee.status === 401, '/api/entities/search refuses with 401 without a session', `received ${protegee.status}`)
} catch (cause) {
  problemes.push(`/api/entities/search unreachable — ${cause.message}`)
}

// --- 3. The share link stays open, and tells the truth
//
//     An invented token must give 404 "this link does not exist", never 401:
//     its recipient has no account, and a 401 would ask them to log in to
//     see a collection that is not theirs.
try {
  const partage = await demander(`/api/public/share/jeton-inexistant-${Date.now()}`)
  verifier(
    partage.status === 404,
    'an unknown share link answers 404 (and not 401)',
    `received ${partage.status}${partage.status === 401 ? ' — the internal error redirect goes through security again' : ''}`,
  )
} catch (cause) {
  problemes.push(`/api/public/share unreachable — ${cause.message}`)
}

// --- 4. The app is installable as it is SERVED
//
//     The MIME type of the manifest does not come from the file but from the
//     server, and this is exactly where it gets lost: nginx does not know the
//     `.webmanifest` extension by default.
try {
  const manifeste = await demander('/manifest.webmanifest')
  verifier(manifeste.status === 200, '/manifest.webmanifest is served', `received ${manifeste.status}`)
  const type = manifeste.headers.get('content-type') ?? ''
  verifier(
    type.includes('application/manifest+json'),
    'the manifest is served as application/manifest+json',
    `content-type: ${type || 'absent'}`,
  )
} catch (cause) {
  problemes.push(`/manifest.webmanifest unreachable — ${cause.message}`)
}

// --- 5. The service worker is not frozen
//
//     A `sw.js` cached by an intermediary freezes the application for the
//     visitors: they keep the old shell until it expires, with no way to know
//     it or to force the update.
try {
  const sw = await demander('/sw.js')
  verifier(sw.status === 200, '/sw.js is served', `received ${sw.status}`)
  const cache = sw.headers.get('cache-control') ?? ''
  verifier(
    /no-cache|no-store|max-age=0/.test(cache),
    'sw.js forbids caching',
    `cache-control: ${cache || 'absent'}`,
  )
} catch (cause) {
  problemes.push(`/sw.js unreachable — ${cause.message}`)
}

// --- 6. A deep route does not fall into a 404
//
//     A reload on `/tier-lists` must return the app shell: without the SPA
//     fallback, the app works as long as we navigate and breaks at the first
//     F5 or the first shared link.
try {
  const profonde = await demander('/tier-lists')
  verifier(profonde.status === 200, '/tier-lists returns the shell (SPA fallback)', `received ${profonde.status}`)
  const type = profonde.headers.get('content-type') ?? ''
  verifier(type.includes('text/html'), '/tier-lists returns HTML', `content-type: ${type || 'absent'}`)
} catch (cause) {
  problemes.push(`/tier-lists unreachable — ${cause.message}`)
}

// --- 7. The anti-CSRF cookie, when there is TLS
//
//     Checked only over HTTPS: locally, `Secure` would prevent the cookie
//     from being set at all, and its absence is then normal.
if (base.startsWith('https://')) {
  try {
    const etat = await demander('/api/auth/etat')
    const cookies = etat.headers.getSetCookie?.() ?? []
    const csrf = cookies.find((c) => c.startsWith('XSRF-TOKEN='))
    if (csrf) {
      verifier(/;\s*Secure/i.test(csrf), 'the XSRF-TOKEN cookie is Secure', csrf)
    }
  } catch {
    // The failure was already reported at point 1: do not count it twice.
  }
}

console.log(`Checking ${base}`)
for (const reussite of reussites) console.log(`  ok   ${reussite}`)
for (const probleme of problemes) console.error(`  KO   ${probleme}`)

if (problemes.length > 0) {
  console.error(`\n${problemes.length} problem(s) out of ${problemes.length + reussites.length} checks.`)
  process.exit(1)
}
console.log(`\n${reussites.length} checks, no problem.`)
