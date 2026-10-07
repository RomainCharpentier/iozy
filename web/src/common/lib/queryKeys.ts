// Centralized TanStack Query query keys, so that invalidations
// (e.g. after a mutation) stay consistent between screens without duplicating
// key arrays by hand everywhere.
export const queryKeys = {
  entities: {
    all: ['entities'] as const,
    search: (params: { q?: string; entityTypeId?: string; tagId?: string }) =>
      ['entities', 'search', params] as const,
    detail: (id: string) => ['entities', id] as const,
  },
  ownerships: (entityId: string) => ['ownerships', entityId] as const,
  /** All the Ownerships (see listAllOwnerships) - key distinct from
   * ownerships(entityId) above so that they never collide in the cache. */
  allOwnerships: ['ownerships', 'all'] as const,
  experiences: (entityId: string) => ['experiences', entityId] as const,
  tags: {
    all: ['tags'] as const,
  },
  relationships: {
    from: (entityId: string) => ['relationships', 'from', entityId] as const,
    to: (entityId: string) => ['relationships', 'to', entityId] as const,
  },
  /** The followed works of the account: the third state, next to ownerships and wishes. */
  followedWorks: { all: ['followedWorks'] as const },
  wishlist: {
    all: ['wishlist'] as const,

  },
  /** The server delivery: it only changes at redeployment. */
  version: ['version'] as const,
  // Space sharing - one single key, because there is only one share left:
  // collection and wishes are two sections of it, not two links.
  share: ['share'] as const,
  sharedSpace: (token: string) => ['share', 'shared', token] as const,
  insights: {
    stats: ['insights', 'stats'] as const,
    discover: (entityTypeCode: string) => ['insights', 'discover', entityTypeCode] as const,
    timeline: ['insights', 'timeline'] as const,
    yearlyRecap: (year: number) => ['insights', 'yearlyRecap', year] as const,
    value: ['insights', 'value'] as const,
    progress: ['insights', 'progress'] as const,
    /** Prefixed by `progress` ON PURPOSE: the existing invalidations
     *  (`insights.progress`) therefore also carry the progress of a work,
     *  without having to list them a second time. */
    progressOf: (entityId: string) => ['insights', 'progress', entityId] as const,
    /** The release calendar of a period - one month on screen, one year for the lists. */
    releases: (from: string, to: string) => ['insights', 'releases', from, to] as const,
    /** The latest releases of the Discover preview. Under 'releases': the same invalidations reach it. */
    latestReleases: ['insights', 'releases', 'latest'] as const,
    /** When the release dates were last refreshed, and whether a pass is running. */
    releaseRefresh: ['insights', 'release-refresh'] as const,
  },
  metadata: {
    search: (entityTypeId: string, query: string) => ['metadata', 'search', entityTypeId, query] as const,
    /** The works already known as having no volumes, for a results page.
     *  Keyed by the list of queried titles: changing the search changes the
     *  question, and two results pages do not have the same answer. */
    sansTomes: (entityTypeId: string, titres: string) => ['metadata', 'sansTomes', entityTypeId, titres] as const,
  },
  entityTypes: {
    all: ['entityTypes'] as const,
  },
  purchaseAnalysis: {
    history: ['purchaseAnalysis', 'history'] as const,
    detail: (id: string) => ['purchaseAnalysis', 'history', id] as const,
    edition: (seriesTitle: string, editionName: string) =>
      ['purchaseAnalysis', 'edition', seriesTitle, editionName] as const,
    allEditions: ['purchaseAnalysis', 'editions', 'all'] as const,
    completeness: (seriesTitle: string, editionName: string, volumes: number[]) =>
      ['purchaseAnalysis', 'completeness', seriesTitle, editionName, volumes] as const,
    nearCompleteSuggestions: ['purchaseAnalysis', 'nearCompleteSuggestions'] as const,
    /** The observed prices of an edition (Éditions de référence screen). */
    marketObservations: (mangaEditionId: string) =>
      ['purchaseAnalysis', 'marketObservations', mangaEditionId] as const,
  },
  /** The volumes that a provider knows for a work, that the catalog does not
   *  have yet (see useTomesProposes). Keyed by type AND title: this is the
   *  pair that the search queries, and two homonymous works of different
   *  types do not have the same volumes. */
  /** The author is part of the question: "the volumes of Doubt" and "the
   *  volumes of Doubt BY Tonogai" do not have the same answer (Batch 123). */
  tomesProposes: (entityTypeId: string, titre: string, auteur?: string) =>
    ['tomesProposes', entityTypeId, titre, auteur ?? null] as const,
  /** The followed edition of a series (see api/followedEdition). Keyed by
   *  series: the detail page, the volume grid and the edition cards all read
   *  it, one single request for the three. */
  followedEdition: (entityId: string) => ['followedEdition', entityId] as const,
  /** Who is signed in, and what the instance allows (see lib/useAuth). Two
   *  distinct keys: the state of the instance is read without an account, the account is not. */
  auth: {
    compte: ['auth', 'compte'] as const,
    etat: ['auth', 'etat'] as const,
  },
  /** The administration of the instance - never anyone's data. */
  admin: {
    comptes: ['admin', 'comptes'] as const,
  },
  tierLists: {
    general: (entityTypeId: string) => ['tierLists', 'general', entityTypeId] as const,
    // null = the cross-cutting "all categories" lists (see TierListDto.entityTypeId) -
    // a separate family, never mixed with those of a given universe.
    custom: (entityTypeId: string | null) => ['tierLists', 'custom', entityTypeId ?? 'all-universes'] as const,
    detail: (id: string) => ['tierLists', 'detail', id] as const,
    entitySummary: (entityId: string) => ['tierLists', 'entitySummary', entityId] as const,
  },
} as const
