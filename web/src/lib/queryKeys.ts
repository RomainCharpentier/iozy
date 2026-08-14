// Clés de requête TanStack Query centralisées, pour que les invalidations
// (ex: après une mutation) restent cohérentes entre écrans sans dupliquer
// des tableaux de clés à la main partout.
export const queryKeys = {
  entities: {
    all: ['entities'] as const,
    search: (params: { q?: string; entityTypeId?: string; tagId?: string }) =>
      ['entities', 'search', params] as const,
    detail: (id: string) => ['entities', id] as const,
  },
  ownerships: (entityId: string) => ['ownerships', entityId] as const,
  /** Toutes les Ownership (voir listAllOwnerships) - clé distincte de
   * ownerships(entityId) ci-dessus pour ne jamais collisionner en cache. */
  allOwnerships: ['ownerships', 'all'] as const,
  experiences: (entityId: string) => ['experiences', entityId] as const,
  tags: {
    all: ['tags'] as const,
  },
  relationships: {
    from: (entityId: string) => ['relationships', 'from', entityId] as const,
    to: (entityId: string) => ['relationships', 'to', entityId] as const,
  },
  wishlist: {
    all: ['wishlist'] as const,
    shareLink: ['wishlist', 'shareLink'] as const,
    shared: (token: string) => ['wishlist', 'shared', token] as const,
  },
  insights: {
    stats: ['insights', 'stats'] as const,
    discover: (entityTypeCode: string) => ['insights', 'discover', entityTypeCode] as const,
    timeline: ['insights', 'timeline'] as const,
    yearlyRecap: (year: number) => ['insights', 'yearlyRecap', year] as const,
    value: ['insights', 'value'] as const,
  },
  metadata: {
    search: (entityTypeId: string, query: string) => ['metadata', 'search', entityTypeId, query] as const,
  },
  entityTypes: {
    all: ['entityTypes'] as const,
  },
  purchaseAnalysis: {
    history: ['purchaseAnalysis', 'history'] as const,
    detail: (id: string) => ['purchaseAnalysis', 'history', id] as const,
    edition: (seriesTitle: string, editionName: string) =>
      ['purchaseAnalysis', 'edition', seriesTitle, editionName] as const,
    editionsForSeries: (seriesTitle: string) => ['purchaseAnalysis', 'editions', seriesTitle] as const,
    completeness: (seriesTitle: string, editionName: string, volumes: number[]) =>
      ['purchaseAnalysis', 'completeness', seriesTitle, editionName, volumes] as const,
    preferences: ['purchaseAnalysis', 'preferences'] as const,
    nearCompleteSuggestions: ['purchaseAnalysis', 'nearCompleteSuggestions'] as const,
  },
  loans: {
    active: ['loans', 'active'] as const,
    byOwnership: (ownershipId: string) => ['loans', 'ownership', ownershipId] as const,
  },
  editionUpgradeWishes: {
    byEntity: (entityId: string) => ['editionUpgradeWishes', 'entity', entityId] as const,
    all: ['editionUpgradeWishes', 'all'] as const,
  },
} as const
