import { defineConfig, devices } from '@playwright/test'

/**
 * Les tests de bout en bout : du clic à la base, sans rien simuler.
 *
 * <h2>Ce qu'ils ajoutent aux 215 tests unitaires</h2>
 * Ceux-là vérifient une règle à la fois, dans un module. Ceux-ci vérifient
 * qu'un **parcours entier tient** : que le bouton est là, qu'il appelle la
 * bonne route, que le serveur écrit, et que l'écran suivant le montre. Aucun
 * test unitaire ne peut attraper un formulaire branché sur le mauvais champ ou
 * une invalidation de cache manquante — l'écran reste juste sur l'état d'avant.
 *
 * <h2>Une pile jetable, jamais les vraies données</h2>
 * `globalSetup` démarre `backend/docker-compose.e2e.yml` : sa propre base, son
 * propre port. Le cloisonnement par propriétaire ne suffirait pas — le
 * catalogue, lui, est partagé, et les séries inventées ici apparaîtraient dans
 * la recherche de la vraie collection.
 *
 * <h2>Un seul worker, à dessein</h2>
 * Ces tests partagent une base. Les paralléliser demanderait soit un compte par
 * worker (le catalogue resterait commun), soit une base par worker (trois piles
 * Docker). Le gain ne vaut pas cette complexité : la suite tient en moins d'une
 * minute.
 */
export default defineConfig({
  testDir: './e2e',
  // Le démarrage de la pile Docker est compté à part (voir globalSetup) ; un
  // parcours, lui, ne doit pas traîner : au-delà, c'est un test qui attend
  // quelque chose qui n'arrivera pas.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  globalSetup: './e2e/pile.setup.ts',
  globalTeardown: './e2e/pile.teardown.ts',
  use: {
    baseURL: 'http://localhost:5174',
    // La trace du premier échec suffit à comprendre : les captures et vidéos
    // systématiques remplissent le disque sans rien apprendre de plus.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // La session est ouverte UNE fois, puis rejouée par chaque parcours :
    // faire passer chaque test par l'écran de connexion ajouterait dix fois
    // le même début, et dix façons de le rater.
    { name: 'compte', testMatch: /compte.setup.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'parcours',
      testIgnore: /compte.setup.ts/,
      dependencies: ['compte'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/session.json' },
    },
  ],
  webServer: {
    // Le serveur de DEV, et non `preview` : c'est lui qui porte le proxy `/api`,
    // donc le montage « une seule origine » que l'application suppose partout
    // (voir vite.config.ts, nginx.conf, vercel.json).
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    timeout: 60_000,
    env: { IOZYCORE_API: 'http://localhost:8090' },
  },
})
