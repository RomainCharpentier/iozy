# iOS (SwiftUI + SwiftData)

**Hors service depuis le 2026-08-29.** L'API exige une session et ce client n'en ouvre aucune : tous ses appels reçoivent 401. Ne le « répare » pas au passage d'un autre travail. Trois issues sont possibles (le rattraper, le geler, le retirer), Le choix est une décision de produit qui n'a pas été prise. Demande avant d'y investir.

Ce qu'il faudrait pour le remettre en marche : les quatre routes `/auth/*`, le cookie `XSRF-TOKEN` renvoyé en `X-XSRF-TOKEN` sur les écritures (les helpers `post`/`patch`/`postEmpty`/`delete` de `APIClient.swift`), un écran de connexion et une porte dans `IozyCoreApp.swift`. Détails dans `README.md`.

## Si tu dois y toucher

- Il faut un Mac avec Xcode 15+ et XcodeGen : `xcodegen generate`, puis ouvrir `IozyCore.xcodeproj` (ignoré par git, généré depuis `project.yml`). Sur cette machine Windows, tu ne peux ni compiler ni tester ce dossier.
- Organisation par fonctionnalité : `DesignSystem/`, `Models/`, `Networking/` (`APIClient` + une extension par domaine), `Features/` (un dossier par écran).
- Un appel API va dans `APIClient+<Domaine>.swift`, jamais dans une vue. Les DTO sont des `struct` Codable en miroir 1:1 des DTO Java.
- Pas de couleurs ni de polices en dur : `Theme.xxx` et les composants de `DesignSystem/`.
- Piège rencontré deux fois : `private`/`fileprivate` sont invisibles depuis un autre fichier, donc ce qui est partagé (DTO, helpers réseau) doit être `internal`. Ne fais jamais conformer un type Foundation (`UUID`…) à un protocole qu'il implémente déjà.
- Renommer l'app : seulement `Config.xcconfig` (`APP_NAME`, `APP_BUNDLE_ID`), puis `xcodegen generate`.
