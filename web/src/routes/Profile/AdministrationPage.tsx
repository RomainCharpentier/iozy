import { Link } from 'react-router-dom'
import { Tags, Upload, ChevronRight, BookMarked, Users } from 'lucide-react'
import { EnTeteSection } from '../../components/EnTeteSection'
import { useAuth } from '../../lib/useAuth'

interface AdminLink {
  to: string
  label: string
  description: string
  icon: typeof Tags
}

// "Administration avancée" (voir l'audit UX) : sépare ce qui configure
// l'app/gère les données brutes (technique, touché une fois puis oublié) de
// ce qu'on consulte pour sa collection (Profil) ou qu'on règle pour son
// confort d'usage (Paramètres) - la personnalisation des types de fiches ou
// l'import BGG n'ont pas leur place au même niveau qu'une wishlist ou des
// statistiques. Accessible uniquement depuis Paramètres, pas d'entrée
// dupliquée ailleurs (voir "réduction réelle de la charge cognitive").
const LINKS: AdminLink[] = [
  { to: '/types', label: 'Types de collection', description: 'Gérer les catégories (mangas, jeux vidéo...) et leurs champs', icon: Tags },
  { to: '/import-bgg', label: 'Importer depuis BGG', description: 'Récupérer tes jeux de société depuis BoardGameGeek', icon: Upload },
  {
    to: '/editions',
    label: 'Éditions de référence',
    description: "Nombre de tomes et éditeur par édition - c'est de là que vient la progression X/Y",
    icon: BookMarked,
  },
]

/**
 * Réservé aux administrateurs, et absent pour les autres.
 * <p>
 * Le masquer n'est PAS ce qui protège : le serveur répond 403 sur
 * {@code /api/admin/**} quel que soit l'écran (voir SecurityConfig). Ce qui se
 * joue ici est autre chose - ne pas proposer une porte qui ne s'ouvrira pas.
 */
const LIEN_COMPTES: AdminLink = {
  to: '/administration/comptes',
  label: 'Comptes',
  description: "Qui a un compte sur cette instance, et en supprimer un - jamais le contenu de leur collection",
  icon: Users,
}

export function AdministrationPage() {
  const { compte } = useAuth()
  const liens = compte?.admin ? [...LINKS, LIEN_COMPTES] : LINKS

  return (
    <div className="flex flex-col gap-5">
      <div>
        <EnTeteSection
          niveau={1}
          titre="Administration avancée"
          sousTitre="Configuration technique et gestion des données — à toucher rarement."
        />
      </div>

      <ul className="flex flex-col gap-2">
        {liens.map(({ to, label, description, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-xl bg-surface p-3 transition-colors hover:bg-surface2"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface2 text-accentText">
                <Icon size={18} />
              </span>
              <span className="flex-1">
                <span className="block font-medium text-textPrimary">{label}</span>
                <span className="block text-xs text-textDim">{description}</span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-textDim" />
            </Link>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-semibold text-textPrimary">Export de la collection</h2>
        <p className="text-sm text-textDim">
          Toute ta collection (séries, tomes, possessions, expériences, wishlist, relations, tags), plus ce que tu
          as saisi à la main et qu'on ne peut pas recalculer : éditions de référence, classements et Tier Lists,
          envies d'amélioration. Format ouvert, lisible sans cette app - pour garantir l'absence d'enfermement,
          même auto-hébergé. Restent dehors, volontairement : l'historique d'analyses d'achat (des instantanés,
          pas des données saisies) et les jetons de partage, qui sont des secrets.
        </p>
        <div className="mt-2 flex gap-2">
          <a
            href="/api/export/json"
            download
            className="rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary hover:bg-surface"
          >
            Télécharger en JSON
          </a>
          <a
            href="/api/export/csv"
            download
            className="rounded-lg bg-surface2 px-3 py-2 text-sm font-medium text-textPrimary hover:bg-surface"
          >
            Télécharger en CSV (.zip)
          </a>
        </div>
      </section>
    </div>
  )
}
