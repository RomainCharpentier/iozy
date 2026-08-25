import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Scale } from 'lucide-react'
import { getEntity, mergeEntityAttributes, renameEntity } from '../../api/entities'
import { listOwnerships } from '../../api/ownerships'
import { listExperiences } from '../../api/experiences'
import { listTags } from '../../api/tags'
import { relationshipsFrom, relationshipsTo } from '../../api/relationships'
import { listEntityTypes } from '../../api/entityTypes'
import { findEdition } from '../../api/purchaseAnalysis'
import { isSeriesOngoing } from '../../lib/seriesInfo'
import { queryKeys } from '../../lib/queryKeys'
import { ErrorBanner } from '../../components/ErrorBanner'
import { WishlistToggle } from '../../components/WishlistToggle'
import { gradientFor } from '../../theme/gradient'
import { COVER_IMAGE_ATTRIBUTE_KEY, coverImageUrlFrom } from '../../lib/coverImage'
import { creatorFrom } from '../../lib/creatorInfo'
import { groupVariantsByEdition, resolveEditionView } from '../../lib/editionGroups'
import { EditionProgressSection } from './EditionProgressSection'
import { TomesGridSection } from './TomesGridSection'
import { TierSummarySection } from './TierSummarySection'
import { TagsSection } from './TagsSection'
import { ExperiencesSection } from './ExperiencesSection'
import { RelationshipsSection } from './RelationshipsSection'
import { DeleteEntitySection } from './DeleteEntitySection'
import { OngletsFiche, type OngletFiche } from './OngletsFiche'
import { EntityInfoSection } from './EntityInfoSection'

export function EntityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const entityId = id!
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // Correction manuelle de la couverture de SÉRIE (audit UX "correction
  // manuelle") - le Tome a sa propre correction équivalente dans
  // VolumeInteractionPanel (voir VariantCoverEditor), jamais la Série
  // elle-même jusqu'ici. Action secondaire (icône crayon discrète sur la
  // bannière), pas un champ de formulaire permanent.
  const [editingCover, setEditingCover] = useState(false)
  const [coverUrlInput, setCoverUrlInput] = useState('')
  const coverMutation = useMutation({
    mutationFn: (coverImageUrl: string) => mergeEntityAttributes(entityId, { [COVER_IMAGE_ATTRIBUTE_KEY]: coverImageUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditingCover(false)
    },
  })
  // Correction manuelle du NOM de série (voir migration "Série -> Édition
  // par ID", historique de la conversation) : ne casse plus les
  // Éditions/Tomes déjà rattachés, leur lien passe désormais par entityId,
  // jamais par une égalité de titre - même action secondaire discrète que
  // la couverture ci-dessus.
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const renameMutation = useMutation({
    mutationFn: (title: string) => renameEntity(entityId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities.detail(entityId) })
      setEditingTitle(false)
    },
  })
  // Édition sélectionnée dans le bloc Identité (voir EditionProgressSection) -
  // portée ici plutôt que dans un des deux composants qui l'utilisent : le
  // hero (progression/édition) et la grille de tomes doivent réagir au même
  // changement d'édition active (voir la maquette validée - regroupés dans
  // un même bloc Identité). Déclaré avant les retours anticipés ci-dessous
  // (règle des Hooks), même si sa valeur ne prend son sens qu'une fois
  // `entity` chargée.
  const [activeEdition, setActiveEdition] = useState<string | null>(null)
  // La jaquette la plus visible de l'application n'avait aucun filet : une URL
  // qui ne repond plus laissait 112 x 168 pixels de vide, sans meme un fond
  // derriere. Le degrade existait pourtant deja, juste en dessous - il ne
  // servait qu'au cas "pas de jaquette du tout". Meme forme que CoverTile.
  // On memorise l'URL fautive et non un booleen : sinon, corriger la couverture
  // laisserait le degrade affiche pour la nouvelle, qui n'a jamais echoue.
  const [couvertureEnEchec, setCouvertureEnEchec] = useState<string | null>(null)
  /**
   * Le panneau visible sous 1100px. Au-delà, les trois coexistent en deux
   * colonnes et cette valeur ne sert plus à rien - d'où des classes qui
   * rétablissent l'affichage à partir du point de bascule.
   *
   * Un état local plutôt que l'URL : c'est une façon de regarder la même
   * fiche, pas une destination. Mettre l'onglet dans l'URL ferait de chaque
   * changement d'angle une entrée d'historique, et le bouton Retour ne
   * ramènerait plus à l'écran précédent mais à l'onglet précédent.
   */
  const [onglet, setOnglet] = useState<OngletFiche>('tomes')
  const barreOngletsRef = useRef<HTMLDivElement>(null)

  // 5 requêtes indépendantes déclenchées en parallèle (React Query émet
  // chaque useQuery dès le rendu, pas de chaînage séquentiel) - même
  // parallélisme que le `async let` groupé de EntityDetailView côté iOS.
  const entityQuery = useQuery({
    queryKey: queryKeys.entities.detail(entityId),
    queryFn: () => getEntity(entityId),
  })
  const ownershipsQuery = useQuery({
    queryKey: queryKeys.ownerships(entityId),
    queryFn: () => listOwnerships(entityId),
  })
  const experiencesQuery = useQuery({
    queryKey: queryKeys.experiences(entityId),
    queryFn: () => listExperiences(entityId),
  })
  const tagsQuery = useQuery({ queryKey: queryKeys.tags.all, queryFn: listTags })
  const relFromQuery = useQuery({
    queryKey: queryKeys.relationships.from(entityId),
    queryFn: () => relationshipsFrom(entityId),
  })
  const relToQuery = useQuery({
    queryKey: queryKeys.relationships.to(entityId),
    queryFn: () => relationshipsTo(entityId),
  })
  const entityTypesQuery = useQuery({ queryKey: queryKeys.entityTypes.all, queryFn: listEntityTypes })

  // Tout ce qui suit vit AVANT les retours anticipés : un Hook ne peut pas
  // être appelé conditionnellement (React rendrait moins de Hooks pendant le
  // chargement qu'après, voir "Rendered fewer hooks than expected"). D'où un
  // `entity` qui tolère null jusqu'à la garde plus bas.
  const entity = entityQuery.data ?? null
  const entityType = entityTypesQuery.data?.find((t) => t.id === entity?.entityTypeId)
  const isManga = entityType?.code === 'MANGA'

  // Édition active partagée entre EditionProgressSection (dans le hero) et
  // TomesGridSection (la grille, hors du hero) - voir activeEdition ci-dessus.
  const editionGroups = entity && isManga ? resolveEditionView(groupVariantsByEdition(entity.variants)) : []
  const activeEditionGroup = editionGroups.find((g) => g.edition === activeEdition) ?? editionGroups[0]

  // Fiche d'édition de l'édition affichée - MÊME clé de cache que
  // EditionProgressSection (React Query partage la requête, aucun appel réseau
  // de plus) : elle alimente le sous-groupe "Édition" du bloc "L'œuvre".
  const activeEditionInfoQuery = useQuery({
    queryKey: queryKeys.purchaseAnalysis.edition(entity?.title ?? '', activeEditionGroup?.edition ?? ''),
    queryFn: () => findEdition(entity!.title, activeEditionGroup!.edition, entityId),
    enabled: !!entity && !!activeEditionGroup && activeEditionGroup.edition !== '',
    retry: false,
  })
  const activeEditionInfo = activeEditionInfoQuery.isSuccess ? activeEditionInfoQuery.data : null

  // isPending, pas isLoading : isLoading retombe à false entre deux tentatives
  // (temporisation exponentielle), et la fiche affichait alors un écran vide.
  if (entityQuery.isPending) return <p className="text-textDim">Chargement...</p>
  if (entityQuery.isError) return <ErrorBanner message={entityQuery.error.message} />
  if (!entity) return null

  const ownerships = ownershipsQuery.data ?? []
  const experiences = experiencesQuery.data ?? []

  const coverImageUrl = coverImageUrlFrom(entity.attributes)
  const montrerCouverture = !!coverImageUrl && coverImageUrl !== couvertureEnEchec
  // mangaka (Manga) ou studio (Jeu vidéo) - voir creatorInfo.ts. Rien pour
  // Jeu de société tant qu'aucune source ne fournit réellement cette donnée.
  const author = creatorFrom(entity.attributes)
  const activeOwnership = ownerships.find((o) => o.status === 'OWNED')
  // Une grille de tomes n'a de sens que pour une serie manga dont une edition
  // est affichee. C'est aussi elle qui decide s'il y a matiere a deux colonnes.
  const grilleDeTomes = isManga && !!activeEditionGroup

  /**
   * Les deux panneaux secondaires sont des CARTES, pas des colonnes nues.
   *
   * C'est ce qui règle le défaut de la version précédente : deux colonnes
   * empilées ont des hauteurs qui dépendent des données (mesuré : 566px contre
   * 799px sur une même fiche), et l'écart se lit comme un trou. Posées dans
   * une grille, deux cartes s'étirent à la hauteur de leur RANGÉE - même
   * hauteur, quel que soit leur contenu. Et un fond propre découpe la page en
   * blocs que l'œil saisit d'un coup, au lieu de sept titres de même poids
   * alignés sur le même fond.
   */
  const CARTE = 'rounded-2xl border border-surface2 bg-surface p-4 shadow-token-sm'

  /**
   * Classes d'un panneau. Écrites en toutes lettres et jamais interpolées :
   * Tailwind scanne le code source, une classe construite dynamiquement ne
   * serait jamais générée (voir AppShell.CONTAINER_CLASS pour le même écueil).
   */
  const classePanneau = (nom: OngletFiche) => {
    if (!grilleDeTomes) return 'flex flex-col gap-6'
    return onglet === nom ? 'flex flex-col gap-6' : 'hidden flex-col gap-6 min-[900px]:flex'
  }

  /**
   * Changer d'onglet depuis le bas d'un panneau long déposerait ailleurs au
   * hasard - le navigateur garde la position, et le panneau d'arrivée est
   * souvent plus court. On ne remonte QUE si la barre est sortie par le haut :
   * remonter alors qu'elle est déjà visible serait un sursaut gratuit.
   */
  function changerDOnglet(suivant: OngletFiche) {
    setOnglet(suivant)
    const barre = barreOngletsRef.current
    if (barre && barre.getBoundingClientRect().top < 0) barre.scrollIntoView({ block: 'start' })
  }
  const bestExperience = experiences.reduce<(typeof experiences)[number] | null>((best, exp) => {
    if (exp.rating === null) return best
    if (!best || (best.rating ?? -1) < exp.rating) return exp
    return best
  }, null)

  return (
    <div className="flex flex-col gap-6">
      {/* MangaHero : cover + identité + progression + édition regroupés dans
          UN SEUL bloc (voir la maquette validée) - la progression et
          l'édition ne sont plus des sections pleine largeur séparées, elles
          vivent dans la colonne de contenu à droite de la jaquette, plafonnée
          à 560px (voir hero-content) pour ne jamais s'étirer sur toute la
          largeur du container élargi de la page (une barre de progression à
          1500px de large serait absurde). Grille desktop à 2 colonnes fixes
          (200px jaquette + jusqu'à 520px de contenu) à partir de 768px ; en
          dessous, une ligne flex plus modeste - même composition côte-à-côte
          du mobile au desktop (voir la maquette mobile "[Couverture]
          [Titre/auteur]", déjà côte-à-côte, jamais empilé), seule la taille
          de la jaquette grandit. Remplace l'ancienne bannière horizontale
          h-40 décorative, qui ne permettait pas de reconnaître la jaquette
          (recadrée en fond, jamais montrée entière). */}
      {/* Une TROISIÈME colonne au-delà de 1100px. Sans elle, le hero
          s'arrêtait à 790px dans un conteneur de 1206 : plus de 400px de vide
          sur toute la hauteur du bloc, en haut de page, là où l'œil arrive
          d'abord. Le plafond de 560px sur la colonne d'identité est justifié -
          une barre de progression étirée serait absurde - mais il fallait
          alors donner un emploi à ce qui reste, pas le laisser blanc.

          Ce qui va à droite, ce sont les ACTIONS : évaluer une annonce,
          ajouter aux envies. Le bloc d'identité garde ce qui décrit (titre,
          auteur, type, progression), la troisième colonne prend ce qu'on peut
          faire. C'est aussi ce qui raccourcit le hero, ces actions
          l'allongeaient par le bas. */}
      {/* Flex et non grille, après une fausse piste qui vaut d'être écrite :
          la version à trois pistes était bien posée sur l'élément et la media
          query bien active, mais les tuiles restaient à deux. Cause réelle -
          `md:grid-cols-A` et `min-[1100px]:grid-cols-B` s'appliquent TOUS LES
          DEUX au-delà de 1100px, et c'est l'ordre source qui tranche, pas la
          largeur du point de bascule. Deux utilitaires qui se disputent la
          même propriété sur des paliers imbriqués : à éviter. En flex, aucune
          concurrence - la ligne se remplit, et ce qui ne tient pas passe
          dessous.

          Le tout est enveloppé pour que la jaquette et l'identité restent
          solidaires : c'est un seul bloc qui côtoie les actions, pas deux
          éléments qui pourraient se retrouver séparés par un retour à la
          ligne. */}
      <div className="flex flex-wrap items-start gap-4 sm:gap-6 md:gap-8">
        <div className="flex min-w-0 items-start gap-4 sm:gap-6 md:gap-8 md:max-w-[792px] md:flex-1">
        <div
          className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-2xl sm:w-36 md:w-[200px]"
          style={montrerCouverture ? undefined : { background: gradientFor(entity.title) }}
        >
          {montrerCouverture && (
            <img
              src={coverImageUrl}
              alt=""
              onError={() => setCouvertureEnEchec(coverImageUrl)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <button
            type="button"
            onClick={() => {
              setCoverUrlInput(coverImageUrl ?? '')
              setEditingCover(true)
            }}
            aria-label="Modifier la couverture de la série"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-textPrimary hover:bg-black/70"
          >
            <Pencil size={13} />
          </button>
        </div>
        {/* hero-content : max-width 560px (voir ci-dessus) - important, pas
            1fr/flex-1 sans plafond jusqu'à la largeur du container large. */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:max-w-[560px]">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-2xl font-bold text-textPrimary sm:text-3xl">{entity.title}</h1>
              <button
                type="button"
                onClick={() => {
                  setTitleInput(entity.title)
                  setEditingTitle(true)
                }}
                aria-label="Modifier le nom de la série"
                className="shrink-0 text-textDim hover:text-textPrimary"
              >
                <Pencil size={13} />
              </button>
            </div>
            {author && <p className="text-sm text-textDim sm:text-base">{author}</p>}
            {/* Type en petite pastille discrète : aide à reconnaître le type
                immédiatement (même principe que les tuiles de Ma Collection),
                sans répéter l'éditeur ici - déjà porté par la ligne Édition et
                "À propos" plus bas (voir EditionProgressSection/
                TomesGridSection), pas la peine de le montrer deux fois. */}
            {entityType && (
              <span className="w-fit rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-textDim">
                {entityType.label}
              </span>
            )}
          </div>

          {/* Progression + édition (Manga) - voir EditionProgressSection.
              Pastilles Possédé/expérience (jeu vidéo, jeu de société) sinon :
              même emplacement conceptuel ("état personnel" du bloc Identité),
              pas de grille de tomes pour ces types donc pas de progression à
              afficher à la place. */}
          {isManga && activeEditionGroup && (
            <EditionProgressSection
              entityId={entityId}
              entityTitle={entity.title}
              variants={entity.variants}
              ownerships={ownerships}
              displayGroups={editionGroups}
              activeGroup={activeEditionGroup}
              onSelectEdition={setActiveEdition}
            />
          )}
        </div>
        </div>

        {/* ---------- Ce qu'on peut FAIRE ----------
            `w-full` tant qu'on est sous 1100px : le bloc occupe une ligne
            entière et passe donc sous la jaquette, comme aujourd'hui. Au-delà,
            il reprend une largeur naturelle et absorbe ce qui reste de la
            ligne - ces quatre cents pixels qui restaient blancs en haut de
            page. */}
        <div className="flex w-full flex-col gap-3 min-[1100px]:ml-auto min-[1100px]:w-auto min-[1100px]:max-w-[420px] min-[1100px]:min-w-[260px]">
          {isManga && activeEditionGroup ? (
            <>
              {/* Point d'entrée contextuel vers Analyse d'achat (voir la
                  maquette V1.2, evalFromHere). Libellé et sous-titre
                  explicites : "Évaluer une annonce" seul, posé au milieu
                  d'une fiche de série possédée, ne disait ni de quelle
                  annonce il s'agissait, ni ce que la série venait y faire -
                  signalé directement par l'utilisateur. La série ET
                  l'édition affichée sont maintenant emportées dans l'écran
                  d'analyse (voir PurchaseAnalysisPage, location.state - même
                  mécanisme que SearchPage -> AddDraftPage), ce qui rend le
                  libellé littéralement vrai plutôt qu'à moitié tenu. */}
              <div className="flex w-fit max-w-[420px] flex-col gap-1">
                <button
                  type="button"
                  onClick={() =>
                    navigate('/purchase-analysis', {
                      state: { seriesTitle: entity.title, editionName: activeEditionGroup.edition },
                    })
                  }
                  className="flex w-fit items-center gap-2 rounded-xl bg-surface px-3.5 py-2.5 text-sm font-semibold text-textPrimary shadow-token-sm transition-transform hover:-translate-y-0.5"
                >
                  <Scale size={16} />
                  Évaluer une annonce de cette série
                </button>
                <p className="text-xs text-textDim">
                  Tu as trouvé un lot d'occasion (Vinted, Leboncoin...) ? Compare le prix demandé à ta collection :
                  tomes qui te manquent, doublons, prix conseillé pour négocier.
                </p>
              </div>
            </>
          ) : (
            !isManga && (
              <div className="flex flex-wrap gap-2">
                {activeOwnership && (
                  <span className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accentInk">Possédé</span>
                )}
                {bestExperience && (
                  <span className="rounded-full bg-surface px-3 py-1 text-sm font-medium text-textDim">
                    {bestExperience.experienceType} · {bestExperience.rating}/10
                  </span>
                )}
              </div>
            )
          )}

          {/* Envies : la décision « je le veux » se prend en regardant la
              fiche, c'est donc là que le bouton doit vivre.

              Hors de toute condition, à dessein. Il vivait dans la branche
              « manga avec une édition affichée », si bien qu'il manquait
              exactement là où on le cherche : sur la fiche d'une œuvre
              justement SOUHAITÉE - qui n'a ni tome ni édition, et n'a donc
              jamais d'édition affichée - et sur toute fiche non-manga. Une
              œuvre en envies pouvait ainsi ouvrir sa fiche sans qu'aucun
              élément n'indique qu'elle y était, ni ne permette de l'en
              retirer. Vouloir une œuvre ne dépend ni de son type, ni de ce
              qu'on en possède déjà. */}
          <WishlistToggle entityId={entity.id} />
        </div>
      </div>

      {editingTitle && (
        <div className="flex items-center gap-2">
          <input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="Nom de la série"
            autoFocus
            className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-sm text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={() => titleInput.trim() && renameMutation.mutate(titleInput.trim())}
            disabled={!titleInput.trim() || renameMutation.isPending}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accentInk disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setEditingTitle(false)}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-textDim"
          >
            Annuler
          </button>
        </div>
      )}
      {editingTitle && renameMutation.isError && <ErrorBanner message={renameMutation.error.message} />}

      {editingCover && (
        <div className="flex items-center gap-2">
          <input
            value={coverUrlInput}
            onChange={(e) => setCoverUrlInput(e.target.value)}
            placeholder="URL de l'image (ex: https://...)"
            autoFocus
            className="min-w-0 flex-1 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs text-textPrimary placeholder:text-textDim focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            onClick={() => coverUrlInput.trim() && coverMutation.mutate(coverUrlInput.trim())}
            disabled={!coverUrlInput.trim() || coverMutation.isPending}
            className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accentInk disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setEditingCover(false)}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-textDim"
          >
            Annuler
          </button>
        </div>
      )}
      {editingCover && coverMutation.isError && <ErrorBanner message={coverMutation.error.message} />}

      {/* Deux colonnes au-delà de 1100px : à gauche ce qu'on CONSULTE (la
          grille des tomes), à droite ce qu'on RENSEIGNE (classement,
          informations, tags, expériences, relations).

          Rien n'est retiré, rien n'est replié de plus - c'est le même contenu
          sur deux axes au lieu d'un. Le conteneur de cette page monte à
          1600px, et une seule colonne le traversait : l'œil descendait pour
          atteindre des choses qui tiennent côte à côte.

          Même point de bascule et même idiome que DiscoverPage, qui fait déjà
          exactement ça (min-[900px]:grid + items-start). Une différence
          assumée : minmax(0, …) plutôt que « 1.65fr » nu. Une piste « 1.65fr »
          vaut minmax(auto, 1.65fr), donc plancher au CONTENU - c'est ce
          plancher-là qui, sur DiscoverTierPreview, faisait défiler toute la
          page dès qu'un titre en « truncate » s'y trouvait.

          Une seule colonne quand il n'y a pas de grille de tomes (jeu vidéo,
          type personnalisé, série seulement en envies) : sinon la gauche
          serait vide et la droite porterait tout. */}
      {grilleDeTomes && (
        <div ref={barreOngletsRef} className="mt-6 min-[900px]:hidden">
          <OngletsFiche actif={onglet} onChange={changerDOnglet} />
        </div>
      )}

      <div className="flex flex-col gap-6">
        {/* "Mes tomes" prend TOUTE la largeur, et non plus les deux tiers
            gauches. C'est la zone principale de la fiche : lui donner le
            container entier, c'est plus de tomes par rangée donc moins de
            rangées - et c'est la seule chose de cette page qui gagne
            réellement à s'étaler. Elle reste sur le fond de page, sans carte :
            c'est le sujet, pas un encadré.

            mt-6 en plus du gap-6 déjà porté par le conteneur racine = 48px au
            total entre le hero et "Mes tomes" (cible 40-48px, voir la maquette
            validée) - une vraie séparation visuelle, pas la même respiration
            que le reste de la page. */}
        {grilleDeTomes && (
          <div className={classePanneau('tomes') + ' min-[900px]:mt-6'}>
            <TomesGridSection
              entityId={entityId}
              entityTypeId={entity.entityTypeId}
              entityTitle={entity.title}
              variants={entity.variants}
              ownerships={ownerships}
              experiences={experiences}
              activeGroup={activeEditionGroup}
            />
          </div>
        )}

        {/* Les deux panneaux secondaires, côte à côte à partir de 1100px.
            Pas de items-start ici, à dessein : l'étirement par défaut d'une
            grille leur donne la hauteur de leur rangée, donc la MÊME hauteur.
            C'est exactement ce que les deux colonnes empilées ne savaient pas
            faire.

            display:contents en petit : ce conteneur n'existe que pour les
            ranger côte à côte en grand. En dessous il doit s'effacer, sinon il
            imposerait son gap entre deux panneaux dont un seul est visible -
            un vide de 24px sous chaque onglet. */}
        <div
          className={
            grilleDeTomes
              ? 'contents min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:gap-6'
              : 'flex flex-col gap-6 min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:gap-6'
          }
        >
          {/* ---------- Mon avis : ce que J'EN PENSE ---------- */}
          <div className={classePanneau('avis') + ' ' + CARTE}>
      {/* "Mes classements" pour toutes les autres fiches. La grille de tomes
          la porte déjà pour une série manga dont une édition est affichée
          (voir TomesGridSection, qui la place avant "À propos" comme le veut
          la maquette) - ce rendu-ci prend le relais partout ailleurs, jamais
          les deux à la fois.

          Sans lui, classer une œuvre depuis sa fiche était réservé aux mangas
          possédés : un jeu vidéo, un type personnalisé ou une série seulement
          mise en envies n'avaient AUCUN accès au classement, alors que le
          backend sait depuis toujours classer n'importe quelle Entity, sans
          exiger la moindre possession. Un classement dit ce qu'on pense d'une
          œuvre, pas ce qu'on possède. */}
            <TierSummarySection
              entityId={entityId}
              entityTitle={entity.title}
              entityTypeLabel={entityType?.label ?? null}
              coverImageUrl={coverImageUrlFrom(entity.attributes)}
            />

            {/* Une Expérience ne dépend d'aucune Possession - c'est l'un des
                invariants du modèle. Elle vit donc avec le classement et les
                tags, sous « ce que j'en pense », jamais sous « ce que j'ai ». */}
            <ExperiencesSection
              entityId={entityId}
              experiences={experiences}
              allowedExperienceTypes={entityType?.allowedExperienceTypes ?? []}
              variants={entity.variants}
            />

            <TagsSection entityId={entityId} attachedTagIds={entity.tagIds} allTags={tagsQuery.data ?? []} />
          </div>

          {/* ---------- L'œuvre : ce QU'ELLE EST ---------- */}
          <div className={classePanneau('oeuvre') + ' ' + CARTE}>

      {/* "Informations" : les attributs de l'œuvre, affichés ET modifiables,
          pour TOUS les types - un jeu ou un type personnalisé n'affichait
          jusqu'ici aucune information (voir EntityInfoSection : "À propos"
          est propre aux mangas et vit dans TomesGridSection). Ce qu'une API
          a copié en base devient une donnée à soi, donc corrigeable. */}
      <EntityInfoSection
        entityId={entityId}
        attributes={entity.attributes}
        customFieldKeys={entityType?.customFieldKeys ?? []}
        edition={
          activeEditionGroup && activeEditionGroup.edition !== ''
            ? {
                name: activeEditionGroup.edition,
                publisher: activeEditionInfo?.publisher ?? null,
                outOfPrint: activeEditionInfo?.outOfPrint ?? false,
                betterEditionAnnounced: activeEditionInfo?.betterEditionAnnounced ?? false,
                betterEditionNote: activeEditionInfo?.betterEditionNote ?? null,
                ongoing: isSeriesOngoing(entity.attributes),
              }
            : null
        }
      />

            {/* Une relation est un fait de catalogue - « ceci adapte cela » -
                pas un avis ni une possession. */}
            <RelationshipsSection
              entityId={entityId}
              relationshipsFrom={relFromQuery.data ?? []}
              relationshipsTo={relToQuery.data ?? []}
            />

            {/* Dernière ligne du dernier panneau, derrière sa propre
                confirmation et sous sa bordure : une action destructive n'est
                pas cachée, elle est simplement au bout. */}
            <div className="flex flex-col gap-2 border-t border-danger/20 pt-3">
              <DeleteEntitySection entityId={entityId} entityTitle={entity.title} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
