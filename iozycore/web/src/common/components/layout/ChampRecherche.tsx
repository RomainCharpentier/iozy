import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, Plus, ScanLine, Search } from 'lucide-react'
import { useAuth } from '@/common/hooks/useAuth'

/**
 * "Chercher ou ajouter": the one entry to find a work or add one, in the top
 * bar on every screen (lot 210). It sends the text to the catalog search
 * (`/add?q=…`), which already searches the instance and the providers.
 *
 * <p>The two other ways to add sit in a small menu inside the field, behind
 * the "+" button: scan a barcode, read a photo. Its items exist only while it
 * is open, so the bar never names a "Scanner" link of its own next to the
 * one of the catalog screen. A visitor adds nothing: no menu for them.
 *
 * <p>`surSoumission` lets a sheet (the mobile search) close itself.
 */
export function ChampRecherche({
  surSoumission,
  autoFocus = false,
  className = 'min-w-0 w-auto flex-1 max-w-[300px]',
}: {
  surSoumission?: () => void
  autoFocus?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  const { estInvite } = useAuth()
  const [texte, setTexte] = useState('')
  const [menuOuvert, setMenuOuvert] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const idMenu = useId()

  useEffect(() => {
    if (!menuOuvert) return
    function fermer(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menu.current?.contains(event.target as Node)) {
        setMenuOuvert(false)
      }
    }
    document.addEventListener('click', fermer)
    document.addEventListener('keydown', fermer)
    return () => {
      document.removeEventListener('click', fermer)
      document.removeEventListener('keydown', fermer)
    }
  }, [menuOuvert])

  function chercher(event: FormEvent) {
    event.preventDefault()
    const q = texte.trim()
    navigate(q ? `/add?q=${encodeURIComponent(q)}` : '/add', { state: { recherche: Date.now() } })
    setTexte('')
    surSoumission?.()
  }

  return (
    <form role="search" onSubmit={chercher} className={`iozy-verre iozy-recherche iozy-teinte ${className}`}>
      <Search size={18} aria-hidden="true" className="shrink-0" />
      <input
        type="search"
        value={texte}
        onChange={(event) => setTexte(event.target.value)}
        placeholder="Chercher ou ajouter"
        aria-label="Chercher ou ajouter"
        autoFocus={autoFocus}
        enterKeyHint="search"
      />
      {!estInvite && (
        <div ref={menu} className="relative">
          <button
            type="button"
            onClick={() => setMenuOuvert((ouvert) => !ouvert)}
            aria-expanded={menuOuvert}
            aria-controls={menuOuvert ? idMenu : undefined}
            aria-label="Autres façons d'ajouter"
            title="Autres façons d'ajouter"
            className="flex h-11 w-11 items-center justify-center rounded-full text-textDim hover:text-textPrimary"
          >
            <Plus size={18} />
          </button>
          {menuOuvert && (
            <div
              id={idMenu}
              className="iozy-verre iozy-verre--fort entree-douce absolute top-[calc(100%+12px)] right-0 z-50 flex min-w-56 flex-col gap-0.5 rounded-2xl p-1.5"
            >
              <Link
                to="/scan"
                onClick={() => {
                  setMenuOuvert(false)
                  surSoumission?.()
                }}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-textPrimary"
              >
                <ScanLine size={18} aria-hidden="true" />
                Scanner un code
              </Link>
              <Link
                to="/import-photo"
                onClick={() => {
                  setMenuOuvert(false)
                  surSoumission?.()
                }}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-textPrimary"
              >
                <Camera size={18} aria-hidden="true" />
                Depuis une photo
              </Link>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
