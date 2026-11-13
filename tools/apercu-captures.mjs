// Captures every IozyCore screen of a preview stack, signed in with a throwaway test account.
// Desktop first (1280 x 900), dark then light. Reports horizontal overflow, console errors,
// broken images and failed requests. Nothing here is a product dependency.
//
// Usage: node tools/apercu-captures.mjs <env file> [base url] [out dir]
//   <env file>: lines EMAIL=... and PASSWORD=... (kept outside git)
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { chromium } = createRequire(join(ROOT, 'iozycore/web/package.json'))('playwright')

const envFile = process.argv[2]
const BASE = process.argv[3] ?? 'http://127.0.0.1:8181'
const OUT = process.argv[4] ?? join(ROOT, 'tmp/captures')
if (!envFile) throw new Error('usage: node tools/apercu-captures.mjs <env file> [base url] [out dir]')
mkdirSync(OUT, { recursive: true })
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8').trim().split(/\r?\n/).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)

const ROUTES = [
  ['home', '/'],
  ['collection', '/core/collection'],
  ['room-manga', '/core/collection/00000000-0000-0000-0000-000000000001'],
  ['room-videogames', '/core/collection/00000000-0000-0000-0000-000000000002'],
  ['room-boardgames', '/core/collection/00000000-0000-0000-0000-000000000003'],
  ['detail-one-piece', '/core/entity/249f7cae-1a9b-412e-ab30-7ea817bd6184'],
  ['detail-frieren', '/core/entity/fcfdf45b-c28f-4d24-b881-68130eeecfa5'],
  ['detail-zelda', '/core/entity/3f4831df-690c-4a83-8b90-4a81e307a61d'],
  ['detail-catan', '/core/entity/84399d34-92bd-4d70-a7f3-e68eeb498ccd'],
  ['releases', '/core/releases'],
  ['catalogue', '/core/add'],
  ['to-buy', '/core/to-buy'],
  ['to-buy-analysis', '/core/to-buy/analyse'],
  ['purchase-history', '/core/purchase-analysis/history'],
  ['editions', '/core/editions'],
  ['stats', '/core/stats'],
  ['share', '/core/share'],
  ['profile', '/core/profile'],
  ['profile-import', '/core/profile/import'],
  ['tier-lists', '/core/tier-lists'],
  ['scan', '/core/scan'],
  ['import-photo', '/core/import-photo'],
  ['types', '/core/types'],
  ['administration', '/core/administration'],
  ['not-found', '/core/does-not-exist'],
]

const browser = await chromium.launch({ args: ['--mute-audio'] })
const report = []
for (const scheme of ['dark', 'light']) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, locale: 'fr-FR' })
  // The app reads its theme from this key, not from prefers-color-scheme.
  await context.addInitScript((t) => localStorage.setItem('iozycore.theme', t), scheme)
  const page = await context.newPage()
  await page.goto(BASE + '/api/auth/etat')
  const xsrf = (await context.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value
  const login = await page.request.post(BASE + '/api/auth/login', {
    headers: { 'X-XSRF-TOKEN': xsrf, Origin: BASE, 'Content-Type': 'application/json' },
    data: { email: env.EMAIL, motDePasse: env.PASSWORD },
  })
  console.log(scheme, 'login', login.status())
  if (login.status() !== 200) throw new Error('login failed')

  for (const [name, path] of ROUTES) {
    const errors = []
    const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) }
    const onFailed = (r) => errors.push('request failed: ' + r.url().slice(0, 120))
    page.on('console', onConsole)
    page.on('requestfailed', onFailed)
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 })
    } catch (e) {
      errors.push('goto: ' + e.message.slice(0, 120))
    }
    await page.waitForTimeout(2500)
    const probe = await page.evaluate(() => ({
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).slice(0, 2),
      height: document.documentElement.scrollHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      brokenImages: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    }))
    await page.screenshot({ path: join(OUT, `${name}.${scheme}.png`), fullPage: true })
    page.off('console', onConsole)
    page.off('requestfailed', onFailed)
    report.push({ scheme, name, path, ...probe, errors })
    console.log(scheme, name, probe.height, probe.overflowX ? 'OVERFLOW' : '', probe.brokenImages ? `BROKEN-IMG ${probe.brokenImages}` : '', errors.length ? `ERR ${errors.length}` : '')
  }
  await context.close()
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1))
await browser.close()
