import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { TabBar } from './TabBar'

/** Écrans "bibliothèque visuelle" (grille de couvertures qui doit dominer
 * l'écran) plutôt que formulaire/liste de réglages à largeur de lecture
 * confortable - voir la refonte layout desktop demandée : Ma Collection et
 * la fiche détail (Manga en particulier) doivent pouvoir occuper une part
 * significative d'un écran 1920px, tout le reste (formulaires, Paramètres,
 * Profil...) reste volontairement à la largeur de lecture d'origine, jamais
 * demandé et souvent moins lisible étiré (champs de formulaire flottant
 * dans le vide, listes de liens très larges). `/entity/:id` couvre tous les
 * types (Manga/Jeu vidéo/Jeu de société partagent la même route) : la
 * largeur du container est neutre pour ces deux derniers tant que leur
 * propre mise en page n'est pas retravaillée (voir EntityDetailPage). */
function isWideScreen(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/entity/')
}

/** Mise en page racine : contenu scrollable + barre d'onglets fixe en bas
 * (équivalent du TabView racine de IozyCoreApp.swift). Pas de bouton
 * flottant : essayé pour "Évaluer un achat", mais un FAB signale
 * universellement "créer du nouveau" dans la plupart des apps - l'utiliser
 * pour autre chose n'était pas intuitif (voir ProfilePage, qui héberge
 * "Évaluer un achat" à la place). */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const wide = isWideScreen(pathname)
  return (
    <div className="min-h-screen bg-background">
      <main
        className={`mx-auto px-4 pt-6 pb-24 sm:px-6 lg:px-8 ${wide ? 'max-w-[1600px]' : 'max-w-2xl'}`}
      >
        {children}
      </main>
      <TabBar />
    </div>
  )
}
