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
// in dev): the link follows it instead of a path written by hand.
document.querySelector('a[data-app="core"]').href = import.meta.env.BASE_URL

const marques = { iozycore, iozyplay }
for (const image of document.querySelectorAll('img[data-marque]')) {
  image.src = marques[image.dataset.marque]
}
