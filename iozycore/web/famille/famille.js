// The home of the family: its stylesheet, and the two brand files of the
// charter (the `iozykit` package, linked from the root of the repository).
// Imported here rather than written in the HTML, because Vite only rewrites
// <img src> at build time: in dev, a path out of this folder would never
// reach the browser. An import gives a URL that works in both (/@fs/ in
// dev, inlined or hashed in the build).
import './famille.css'
import iozycore from 'iozykit/brand/iozycore.svg'
import iozyplay from 'iozykit/brand/iozyplay.svg'

// IozyCore lives under the base of this build (/core/ in the Docker image, /
// in dev): its links follow it instead of a path written by hand.
const core = import.meta.env.BASE_URL
for (const link of document.querySelectorAll('a[data-app="core"]')) link.href = core

const marques = { iozycore, iozyplay }
for (const image of document.querySelectorAll('img[data-marque]')) {
  image.src = marques[image.dataset.marque]
}

// The menu of the brand closes on a click elsewhere or on Escape, as in the apps.
const menu = document.querySelector('details.iozy-famille')
document.addEventListener('click', (event) => {
  if (menu.open && !menu.contains(event.target)) menu.open = false
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') menu.open = false
})

// The account link, the same as in the apps: "Connexion" without an IozyCore
// session (a visit counts as none), "Profil" with one. Same origin, same
// cookie: the API answers 401 when nobody is signed in.
const compte = document.querySelector('a[data-compte]')
compte.href = core
fetch('/api/auth/me', { headers: { Accept: 'application/json' } })
  .then((response) => (response.ok ? response.json() : null))
  .then((session) => {
    if (!session || session.invite) return
    compte.textContent = 'Profil'
    compte.title = `Mon profil — ${session.pseudo}`
    compte.href = `${core}profile`
  })
  .catch(() => {})
