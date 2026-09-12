import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { BandeauVisite } from './BandeauVisite'
import { DesktopHeader } from './DesktopHeader'
import { MobileHeader } from './MobileHeader'
import { PiedDePage } from './PiedDePage'
import { TabBar } from './TabBar'
import { useRefusDeVisite } from '@/common/hooks/useRefusDeVisite'

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
 * listes de liens). `medium` sert à « Évaluer un achat ».
 *
 * `detail` est la 4e valeur que le commentaire précédent gardait en réserve
 * « le jour où le besoin apparaît ». Il est apparu, et sur preuve : une
 * capture de la fiche d'une œuvre montre le contenu tassé à gauche et le côté
 * droit blanc sur trois rangées d'affilée - la rangée de tomes s'arrête à
 * mi-largeur, l'Assistant aussi, et le hero garde un trou en son milieu. Une
 * fiche n'a tout simplement pas de quoi remplir 1600px : son bloc d'identité
 * plafonne à 792px et ses actions à 420px, soit 1244px de contenu réel.
 * Marges extérieures plus larges plutôt que trous intérieurs - les premières
 * se lisent comme une mise en page, les seconds comme un défaut. */
type ContentWidth = 'wide' | 'detail' | 'medium' | 'narrow'

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
  wide: 'grid grid-cols-[1fr_min(100%_-_2rem,1600px)_1fr] md:grid-cols-[1fr_min(100%_-_3rem,1600px)_1fr] [--largeur-page:1600px]',
  detail: 'grid grid-cols-[1fr_min(100%_-_2rem,1320px)_1fr] md:grid-cols-[1fr_min(100%_-_3rem,1320px)_1fr] [--largeur-page:1320px]',
  medium: 'grid grid-cols-[1fr_min(100%_-_2rem,960px)_1fr] md:grid-cols-[1fr_min(100%_-_3rem,960px)_1fr] [--largeur-page:960px]',
  narrow: 'grid grid-cols-[1fr_min(100%_-_2rem,672px)_1fr] md:grid-cols-[1fr_min(100%_-_3rem,672px)_1fr] [--largeur-page:672px]',
}

/**
 * Ce qu'une bande PLEINE LARGEUR doit porter pour traverser tout l'écran, et
 * ce que son contenu doit porter pour rester aligné sur le reste de la page.
 *
 * <h2>Une grille à trois colonnes, et pas un `100vw`</h2>
 * `<main>` est une grille `1fr | contenu | 1fr` : tout enfant tombe dans la
 * colonne du milieu (voir la règle `main[data-grille] > *` dans index.css), et
 * celui qui porte `col-span-full` occupe les trois. Aucune unité `vw` n'entre
 * en jeu - or c'est précisément `100vw` qui compte la barre de défilement et
 * fait déborder la page de ~15px, la classe de bug corrigée au Lot 10. La
 * grille, elle, ne connaît que la largeur réellement disponible.
 *
 * <h2>Pourquoi la règle par défaut vit dans `@layer base`</h2>
 * Écrite en utilitaire (`*:col-start-2`), elle l'emporterait sur le
 * `col-span-full` de l'enfant : le sélecteur du parent (`.x > *`) est plus
 * spécifique que la classe de l'enfant. Posée dans la couche `base`, elle
 * passe systématiquement APRÈS les utilitaires dans la cascade des couches -
 * même raisonnement que la règle de survol déjà présente dans index.css.
 */
export const CLASSE_BANDE_PLEINE_LARGEUR = 'col-span-full'

/** Le conteneur intérieur d'une bande pleine largeur : ramène son contenu à
 *  la largeur exacte de la colonne du milieu, pour que rien ne se décale par
 *  rapport au reste de la page.
 *
 *  Passe par `--largeur-page`, posée juste au-dessus par la même entrée de
 *  CONTAINER_CLASS : sans elle, une bande recopierait en dur la largeur de
 *  l'écran pour lequel elle a été écrite, et se décalerait dès qu'on la
 *  réutilise ailleurs - ce qui est exactement ce qu'on fait en la partageant
 *  entre la fiche et l'écran d'ajout. */
export const CLASSE_CONTENU_BANDE =
  'mx-auto w-[calc(100%_-_2rem)] md:w-[min(100%_-_3rem,var(--largeur-page))]'

/** `/entity/:id` couvre tous les types (Manga/Jeu vidéo/Jeu de société
 * partagent la même route) : la largeur du container est neutre pour ces
 * deux derniers tant que leur propre mise en page n'est pas retravaillée
 * (voir EntityDetailPage - hors périmètre pour l'instant). */
function contentWidthFor(pathname: string): ContentWidth {
  // La fiche d'une œuvre a sa propre largeur - voir `detail` ci-dessus.
  // `/apercu` est la même page, lue chez le fournisseur : même largeur, sinon
  // la bande du hero surplomberait une colonne plus étroite.
  if (pathname.startsWith('/entity/') || pathname === '/apercu') return 'detail'
  if (
    pathname === '/' ||
    pathname.startsWith('/discover') ||
    pathname.startsWith('/collection/') ||
    pathname === '/tier-lists' ||
    pathname.startsWith('/tier-lists/')
  )
    return 'wide'
  // « Évaluer un achat » n'est pas un formulaire de réglages : il porte un
  // résumé d'annonce, une liste de tomes en pastilles et des propositions
  // groupées, à l'étroit sur 672 px alors que l'écran est vide autour.
  if (pathname.startsWith('/purchase-analysis')) return 'medium'
  // Le calendrier des sorties pose une grille de sept colonnes et, à côté,
  // la liste de tout ce qui vient dans l'année (lot 146) : deux colonnes qui
  // ne tiennent pas dans 672 px.
  if (pathname.startsWith('/releases')) return 'medium'
  return 'narrow'
}

/** Mise en page racine : contenu scrollable + navigation, mobile (TabBar,
 * fixed en bas) ou desktop (DesktopHeader, sticky en haut) selon la largeur -
 * jamais les deux (voir NAV_BREAKPOINT_PX). Le dégagement de la TabBar
 * (hauteur de la barre + safe-area du bas) est porté par le PIED DE PAGE et
 * non par `<main>` : c'est le pied qui termine la page, et l'espace doit être
 * sous lui pour que la version ne se lise pas derrière la barre fixe. Sur
 * desktop, il n'y a pas de barre à dégager, d'où la valeur plus faible. */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const width = contentWidthFor(pathname)
  // Ici parce que c'est le seul composant qui enveloppe TOUS les écrans
  // privés : un refus de visite doit s'expliquer d'où qu'il vienne.
  useRefusDeVisite()
  return (
    <div className="min-h-screen bg-background">
      <DesktopHeader />
      <MobileHeader />
      {/* Sous les en-têtes et hors de `<main>` : c'est une information sur la
          SESSION, pas sur la page - elle ne doit ni défiler avec le contenu ni
          entrer dans la grille qui le range. Ne rend rien hors visite. */}
      <BandeauVisite />
      {/* `data-grille` est ce que cible la règle de base d'index.css qui range
          chaque enfant dans la colonne du milieu. Un attribut plutôt qu'une
          classe : il dit ce que l'élément EST (une grille de page), pas de
          quoi il a l'air, et rien ne peut le remplacer par mégarde en
          réécrivant un className. */}
      <main data-grille className={`${CONTAINER_CLASS[width]} pt-6 pb-6`}>{children}</main>
      {/* Le dégagement de la barre du pouce est passé de `main` à ce pied :
          c'est lui, désormais, le dernier élément de la page, et l'espace doit
          être SOUS lui - sinon la version se lirait derrière la barre fixe. Le
          bas de document total ne change pas. */}
      <PiedDePage />
      <TabBar />
    </div>
  )
}

// Exporté uniquement pour que les tests/outils puissent s'aligner sur le même
// point de bascule que TabBar/DesktopHeader sans le redupliquer en dur.
export { NAV_BREAKPOINT_PX }
