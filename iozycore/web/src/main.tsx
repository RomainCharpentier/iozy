import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// The fonts of the charter, self-hosted. The weights to load are listed in
// tokens.json of the iozykit package (fonts.packages); the families reach the CSS
// through the kit's --iozy-font-* variables (see index.css).
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import { applyStoredTheme } from '@/common/lib/theme'

import App from '@/app/App'
import { ToastProvider } from '@/common/components/Toast'

// Before the first React render - avoids a flash default theme then
// stored theme (see lib/theme.ts).
applyStoredTheme()

// networkMode 'always': by default, TanStack Query PAUSES any request
// as soon as navigator.onLine becomes false - the request then stays `pending` with
// a `paused` fetchStatus, so `isLoading` is false (isLoading = isPending &&
// isFetching) while no data will ever arrive. The screens fell into
// their "no data" guard and displayed NOTHING anymore: neither loading nor
// error (seen on the work detail page, an entirely white screen).
// This signal is unreliable anyway (navigator.onLine lies as soon as a network
// interface exists) and of no interest here: the API is reached locally, not
// at the other end of the Internet. Without a pause, a request fails openly,
// goes up as `isError`, and the ErrorBanners already in place do their job.
const queryClient = new QueryClient({
  defaultOptions: { queries: { networkMode: 'always' }, mutations: { networkMode: 'always' } },
})

// The service worker is NOT used to work offline (it only caches the shell
// of the app, never /api - see public/sw.js): it is used so that the browser
// offers to install IozyCore on the home screen, which it refuses without a
// `fetch` handler. Only in the prod build: in development, an app shell
// cache would get in the way of hot reload, and the dev server does not
// serve `/sw.js` from `public/` with the same URLs as in production anyway.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // A registration failure (HTTP without TLS, storage refused, private
    // browsing) must not prevent the app from starting: it works
    // exactly the same without it, it just does not get installed.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
    // The worker registered when the app lived at the root of the site (scope
    // `/`) can no longer update itself - its script moved under /core/ and
    // the old address redirects - yet it still intercepts the home page and
    // IozyPlay. Let it go. Only under a prefix: at the root, that scope is ours.
    if (import.meta.env.BASE_URL !== '/') {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            if (registration.scope === `${window.location.origin}/`) registration.unregister()
          }
        })
        .catch(() => {})
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
