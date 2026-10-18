# Polices custom

L'app est conçue pour utiliser **Space Grotesk** (titres) et **Inter** (texte
courant) — direction visuelle validée. Ces polices ne sont **pas encore
présentes** dans ce dossier : je n'ai pas d'accès réseau pour les télécharger
depuis cet environnement. Sans elles, l'app fonctionne normalement mais
affiche la police système à la place (repli automatique et silencieux de
SwiftUI, pas de crash) — juste moins caractéristique visuellement.

## Pour les ajouter (5 minutes)

1. Télécharge les deux familles, gratuites (licence SIL Open Font) :
   - [Space Grotesk sur Google Fonts](https://fonts.google.com/specimen/Space+Grotesk)
   - [Inter sur Google Fonts](https://fonts.google.com/specimen/Inter)
2. Dans chaque .zip téléchargé, récupère les fichiers `.ttf` suivants et
   place-les directement dans **ce dossier** (`IozyCore/Fonts/`) :
   - `SpaceGrotesk-Bold.ttf`
   - `SpaceGrotesk-Medium.ttf`
   - `Inter-Regular.ttf`
   - `Inter-Medium.ttf`
   - `Inter-SemiBold.ttf`

   (Les noms de fichiers doivent correspondre exactement à ceux déclarés
   dans `Info.plist` sous `UIAppFonts` — si le fichier téléchargé a un nom
   légèrement différent, renomme-le.)
3. Relance `xcodegen generate` (le dossier `Fonts/` est repris automatiquement
   comme ressource, puisqu'il est sous `IozyCore/`, déjà déclaré comme
   source du target).
4. Build & Run. Les titres (`Theme.display`, `Theme.displayMedium`) et le
   texte courant (`Theme.body`, `Theme.bodyMedium`, `Theme.bodySemibold`)
   utilisent désormais les vraies polices.

## Vérifier que ça a marché

Dans le simulateur, l'onglet Étagères : le titre "Tes étagères" doit
apparaître dans une police à empattement géométrique (Space Grotesk), pas
la police système SF Pro. Si ce n'est pas le cas, vérifie que les noms de
fichiers dans ce dossier correspondent exactement à ceux de `Info.plist`
(les noms PostScript internes du .ttf doivent aussi correspondre à ceux
utilisés dans `Theme.swift` : `SpaceGrotesk-Bold`, `Inter-SemiBold`, etc. —
pour vérifier le nom PostScript exact d'un .ttf, double-clique dessus sur
Mac pour l'ouvrir dans Polices, l'aperçu affiche le nom complet).
