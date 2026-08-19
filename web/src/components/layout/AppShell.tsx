import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { DesktopHeader } from './DesktopHeader'
import { TabBar } from './TabBar'

/** Point de bascule unique entre navigation mobile (TabBar, en bas, fixed) et
 * navigation desktop (DesktopHeader, en haut, sticky) - voir TabBar.tsx
 * (`md:hidden`) et DesktopHeader.tsx (`hidden md:block`), qui s'appliquent
 * chacune cette même valeur Tailwind (`md` = 768px) indépendamment : les deux
 * ne sont jamais visibles en même temps, sans dépendre d'un état JS. */
const NAV_BREAKPOINT_PX = 768

/** Trois largeurs de contenu nommées plutôt que des tests de route dispersés
 * dans le JSX (voir la refonte layout demandée - "notion explicite" plutôt
 * que des hacks). `wide` = écrans "bibliothèque visuelle" qui doivent pouvoir
 * occuper une part significative d'un écran large (Ma Collection, fiche
 * détail) ; `narrow` = tout le reste (formulaires, Paramètres, Profil...),
 * qui reste à la largeur de lecture d'origine - jamais demandé plus large et
 * souvent moins lisible étiré (champs de formulaire flottants, longues
 * listes de liens). `medium` n'est pas encore utilisé par un écran réel,
 * conservé pour un futur cas intermédiaire plutôt que d'ajouter une 4e valeur
 * arbitraire le jour où le besoin apparaît. */
type ContentWidth = 'wide' | 'medium' | 'narrow'

/** Classes complètes et littérales (jamais un nombre interpolé dans un
 * template string) : Tailwind scanne le CODE SOURCE statiquement pour savoir
 * quelles classes générer - une classe construite dynamiquement
 * (`` `md:w-[...${n}px)]` ``) ne serait jamais détectée et son CSS ne serait
 * jamais généré, silencieusement (le composant fonctionnerait en dev via le
 * serveur Vite qui re-scanne à la volée, mais casserait au build). Chaque
 * variante doit donc apparaître ici mot pour mot. Desktop = `min(100% -
 * 48px, Npx)` centré (jamais littéralement Npx fixe - une fenêtre à 1200px
 * avec un container wide=1600px doit occuper ~1152px, pas déborder) ; mobile
 * = pleine largeur + 16px de marge fixe (voir la refonte layout demandée). */
const CONTAINER_CLASS: Record<ContentWidth, string> = {
  wide: 'w-full px-4 md:mx-auto md:w-[min(100%-48px,1600px)] md:px-0',
  medium: 'w-full px-4 md:mx-auto md:w-[min(100%-48px,960px)] md:px-0',
  narrow: 'w-full px-4 md:mx-auto md:w-[min(100%-48px,672px)] md:px-0',
}

/** `/entity/:id` couvre tous les types (Manga/Jeu vidéo/Jeu de société
 * partagent la même route) : la largeur du container est neutre pour ces
 * deux derniers tant que leur propre mise en page n'est pas retravaillée
 * (voir EntityDetailPage - hors périmètre pour l'instant). */
function contentWidthFor(pathname: string): ContentWidth {
  if (pathname === '/' || pathname.startsWith('/entity/') || pathname.startsWith('/discover')) return 'wide'
  return 'narrow'
}

/** Mise en page racine : contenu scrollable + navigation, mobile (TabBar,
 * fixed en bas) ou desktop (DesktopHeader, sticky en haut) selon la largeur -
 * jamais les deux (voir NAV_BREAKPOINT_PX). Padding bas de `<main>` réservé à
 * la TabBar (hauteur de la barre + safe-area du bas) uniquement en dessous du
 * point de bascule : sur desktop, il n'y a pas de barre fixe à dégager, le
 * contenu peut naturellement finir avant le bas de l'écran sans réserver un
 * grand espace vide artificiel. */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const width = contentWidthFor(pathname)
  return (
    <div className="min-h-screen bg-background">
      <DesktopHeader />
      <main className={`${CONTAINER_CLASS[width]} pt-6 pb-24 md:pb-10`}>{children}</main>
      <TabBar />
    </div>
  )
}

// Exporté uniquement pour que les tests/outils puissent s'aligner sur le même
// point de bascule que TabBar/DesktopHeader sans le redupliquer en dur.
export { NAV_BREAKPOINT_PX }
