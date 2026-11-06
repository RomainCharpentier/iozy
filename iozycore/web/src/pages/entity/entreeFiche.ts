import { mouvementReduit } from '@/common/lib/volJaquette'

const COURBE = 'cubic-bezier(.2,.8,.2,1)'

function animer(element: Element, images: Keyframe[], options: KeyframeAnimationOptions): void {
  if (typeof element.animate === 'function') element.animate(images, { easing: COURBE, fill: 'backwards', ...options })
}

/**
 * Arriving on a work from its shelf, while its cover flies: the color of the
 * series opens from the cover, the page rises, the volumes stand up one by one
 * and the planks draw themselves. Readable at rest whatever happens.
 */
export function animerEntreeFiche(): void {
  if (mouvementReduit()) return
  const jaquette = document.querySelector('[data-cible-vol]')?.getBoundingClientRect()
  const teinte = document.querySelector('[data-teinte-fiche]')
  if (jaquette && teinte) {
    const fond = teinte.getBoundingClientRect()
    const x = jaquette.left + jaquette.width / 2 - fond.left
    const y = jaquette.top + jaquette.height / 2 - fond.top
    animer(teinte, [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(1700px at ${x}px ${y}px)` }], {
      duration: 760,
    })
  }
  document.querySelectorAll('[data-colonne-fiche] > *').forEach((bloc, rang) =>
    animer(bloc, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], {
      duration: 460,
      delay: 120 + Math.min(rang * 45, 300),
    }),
  )
  document.querySelectorAll('[data-dos-cle]').forEach((dos, rang) =>
    animer(dos, [{ opacity: 0, transform: 'translateX(-40px) scale(.6)' }, { opacity: 1, transform: 'none' }], {
      duration: 620,
      delay: 160 + Math.min(rang * 10, 260),
    }),
  )
  document.querySelectorAll('[data-planche-etage]').forEach((planche) =>
    animer(
      planche,
      [
        { opacity: 0, transform: 'scaleX(.2)', transformOrigin: 'left' },
        { opacity: 1, transform: 'none', transformOrigin: 'left' },
      ],
      { duration: 560, delay: 90 },
    ),
  )
}
