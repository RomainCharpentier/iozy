import { Link } from 'react-router-dom'
import { Tags, ChevronRight, BookMarked, Users, Hash } from 'lucide-react'
import { EnTeteSection } from '@/common/components/EnTeteSection'
import { useAuth } from '@/common/hooks/useAuth'

interface AdminLink {
  to: string
  label: string
  description: string
  icon: typeof Tags
}

/**
 * What is neither an account setting, nor a device setting.
 *
 * <h2>Two sections, two scales</h2>
 * <b>Ma collection</b>: what DESCRIBES it - the categories it accepts, the
 * reference editions that make the "X/Y" possible, and the tags set
 * on the works. It is configured once and then forgotten, unlike the
 * theme or the language of the titles, which stay in Paramètres.
 * <p>
 * The <b>tags</b> are only there for an administrator, unlike the two
 * others: they describe a work of the SHARED catalog, and setting them therefore
 * commits all the accounts (see TagController). Reading them, on the other hand, is
 * open - it is what makes the filter of Ma collection usable.
 *
 * <p><b>Cette instance</b>: the machine, not the data. A single entry -
 * the accounts - and it only appears for an administrator.
 *
 * <h2>What left this screen</h2>
 * The <b>export</b>: it lived here, next to the collection categories, as
 * if downloading one's collection were technical configuration. It is the
 * opposite - it is the guarantee of being able to leave with one's data, and it
 * belongs to the account that owns it, therefore to <b>Paramètres ▸ Mon compte</b>.
 *
 * <p>The <b>BGG import</b>: getting one's games from BoardGameGeek is
 * ADDING to one's collection - the same intention as typing a title or scanning a
 * barcode, with a third source. It joined <b>Rechercher</b>, next
 * to Scanner. Nothing administrative in it.
 *
 * <p>These two departures say the same thing: this screen describes or configures, it
 * does nothing in the place of the user.
 */
const MA_COLLECTION: AdminLink[] = [
  {
    to: '/types',
    label: 'Catégories de collection',
    description: 'Mangas, jeux vidéo, jeux de société... et les champs de chacune',
    icon: Tags,
  },
  {
    to: '/editions',
    label: 'Éditions de référence',
    description: "Nombre de tomes et éditeur par édition - c'est de là que vient la progression X/Y",
    icon: BookMarked,
  },
]

/**
 * Reserved for administrators, and absent for the others.
 * <p>
 * Hiding it is NOT what protects: the server answers 403 on
 * {@code /api/admin/**} whatever the screen (see SecurityConfig). What is
 * at stake here is something else - not offering a door that will not open.
 */
/** Reserved for administrators, like the accounts - and for the same reason:
 *  what one does there commits the others. */
const TAGS: AdminLink = {
  to: '/administration/tags',
  label: 'Tags',
  description: "Les étiquettes posées sur les œuvres - renommer, supprimer, voir ce qu'elles servent",
  icon: Hash,
}

const CETTE_INSTANCE: AdminLink[] = [
  {
    to: '/administration/comptes',
    label: 'Comptes',
    description: "Qui a un compte ici, et en supprimer un - jamais le contenu de leur collection",
    icon: Users,
  },
]

export function AdministrationPage() {
  const { compte } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <EnTeteSection
        niveau={1}
        titre="Administration"
        sousTitre="Ce qui décrit ta collection, et la machine qui l'héberge — à toucher rarement."
      />

      <Groupe titre="Ma collection" liens={compte?.admin ? [...MA_COLLECTION, TAGS] : MA_COLLECTION} />
      {compte?.admin && <Groupe titre="Cette instance" liens={CETTE_INSTANCE} />}
    </div>
  )
}

function Groupe({ titre, liens }: { titre: string; liens: AdminLink[] }) {
  // `aria-labelledby` and not a simple visual title: without an accessible name, a
  // <section> is not a landmark - a screen reader goes through it without being able to
  // jump from one group to another, and the two scales become a single flat
  // list again, exactly what we have just untangled.
  const id = `groupe-${titre.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-display text-lg font-semibold text-textPrimary">
        {titre}
      </h2>
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
    </section>
  )
}
