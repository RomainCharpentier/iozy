import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './index.css'
import { applyStoredTheme } from './lib/theme'

import App from './App.tsx'

// Avant le premier rendu React - évite un flash thème par défaut puis
// thème stocké (voir lib/theme.ts).
applyStoredTheme()

// networkMode 'always' : par défaut, TanStack Query MET EN PAUSE toute requête
// dès que navigator.onLine passe à false - la requête reste alors `pending` avec
// un fetchStatus `paused`, donc `isLoading` vaut false (isLoading = isPending &&
// isFetching) alors qu'aucune donnée n'arrivera jamais. Les écrans tombaient
// dans leur garde "pas de données" et n'affichaient plus RIEN : ni chargement,
// ni erreur (constaté sur la fiche d'œuvre, écran entièrement blanc).
// Ce signal est de toute façon peu fiable (navigator.onLine ment dès qu'une
// interface réseau existe) et sans intérêt ici : l'API est jointe en local, pas
// à l'autre bout d'Internet. Sans pause, une requête échoue franchement,
// remonte en `isError`, et les ErrorBanner déjà en place font leur travail.
const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: 'always' }, mutations: { networkMode: 'always' } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
