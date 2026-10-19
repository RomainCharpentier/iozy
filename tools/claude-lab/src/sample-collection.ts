import { range, type Collection } from './collection.ts'

// Demo data only. Titles and volume counts follow the demo set of the design
// mockups; what is owned is invented. Two "Dragon Ball" series exist on
// purpose: a query for "dragon" must be reported as ambiguous.
export const sampleCollection: Collection = {
  series: [
    {
      title: 'Fullmetal Alchemist',
      author: 'Hiromu Arakawa',
      editions: [
        { name: 'Perfect Edition', totalVolumes: 18, ownedVolumes: range(1, 8) },
        { name: 'Édition classique', totalVolumes: 27, ownedVolumes: range(1, 4) },
        { name: 'Collector', totalVolumes: 6, ownedVolumes: [] },
      ],
    },
    {
      title: 'One Piece',
      author: 'Eiichiro Oda',
      editions: [{ name: 'Édition originale', totalVolumes: 108, ownedVolumes: range(1, 38) }],
    },
    {
      title: 'Chainsaw Man',
      author: 'Tatsuki Fujimoto',
      editions: [{ name: 'Édition Kazé', totalVolumes: 17, ownedVolumes: range(1, 14) }],
    },
    {
      title: 'Jujutsu Kaisen',
      author: 'Gege Akutami',
      editions: [{ name: 'Édition Ki-oon', totalVolumes: 30, ownedVolumes: range(1, 28) }],
    },
    {
      title: 'Death Note',
      author: 'Tsugumi Ohba',
      editions: [{ name: 'Black Edition', totalVolumes: 6, ownedVolumes: range(1, 6) }],
    },
    {
      title: 'Naruto',
      author: 'Masashi Kishimoto',
      editions: [{ name: 'Édition originale', totalVolumes: 72, ownedVolumes: range(1, 27) }],
    },
    {
      title: 'Dragon Ball',
      author: 'Akira Toriyama',
      editions: [{ name: 'Perfect Edition', totalVolumes: 34, ownedVolumes: range(1, 12) }],
    },
    {
      title: 'Dragon Ball Super',
      author: 'Toyotarou',
      editions: [{ name: 'Édition standard', totalVolumes: 22, ownedVolumes: range(1, 3) }],
    },
  ],
}
