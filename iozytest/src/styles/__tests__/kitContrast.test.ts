import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Les styles sont lus comme du texte : jsdom ne calcule pas les couleurs,
// on vérifie donc que chaque règle s'appuie sur les jetons que le kit contrôle.
const root = resolve(process.cwd(), 'src')
const read = (path: string) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n')

function rule(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `règle ${selector} introuvable`).toBeGreaterThan(-1)
  return css.slice(start, css.indexOf('\n}', start))
}

function moduleFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return moduleFiles(path)
    return name.endsWith('.module.scss') ? [path] : []
  })
}

describe('styles IozyTest - contrastes du kit', () => {
  const game = read('pages/GamePage/Game.module.scss')

  it('écrit les libellés de la barre du haut avec accent-text, pas accent-ink', () => {
    const css = rule(game, '.gameInterfaceActionBtn')
    expect(css).toContain('color: var(--accent-text);')
    expect(css).not.toContain('--accent-ink')
  })

  it('pose le compteur de joueurs en accent-text sur la teinte accent', () => {
    const css = rule(game, '.gameInterfaceSidebarCount')
    expect(css).toContain('color: var(--accent-text);')
    expect(css).toContain('background: var(--accent-alpha-1);')
    expect(css).not.toContain('--accent-ink')
  })

  it('prend un anneau de focus en accent plein (3:1), pas une teinte à 30 %', () => {
    const tokens = read('styles/design-tokens.scss')
    expect(tokens).toContain('--focus-ring: 0 0 0 2px var(--iozy-accent);')
    expect(tokens).not.toMatch(/--focus-ring:[^;]*alpha/)
  })

  it('montre le focus clavier des curseurs de réglage', () => {
    const css = rule(game, '.timerSlider:focus-visible')
    expect(css).toContain('outline: 2px solid var(--accent-primary);')
  })

  it("n'utilise plus de teintes rouge, verte ou ambre codées en dur", () => {
    const hardCoded = /rgba\(\s*(239,\s*68,\s*68|16,\s*185,\s*129|245,\s*158,\s*11)\s*,/
    const offenders = moduleFiles(root).filter((file) => hardCoded.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('écrit en danger-text le texte posé sur la teinte danger', () => {
    const files: Array<[string, string]> = [
      ['components/common/ConfirmDialog.module.scss', '.iconDanger'],
      ['components/editor/CategorySelector.module.scss', '.error'],
      ['pages/EditorPage/CategoryManager.module.scss', '.youtubeErrorMessage'],
      ['pages/EditorPage/QuestionEditor.module.scss', '.youtubeErrorMessage'],
    ]
    for (const [file, selector] of files) {
      const css = read(file)
      const block = rule(css, selector)
      expect(block).toContain('background: var(--error-alpha);')
      expect(block).toContain('color: var(--error-text);')
    }
  })
})
