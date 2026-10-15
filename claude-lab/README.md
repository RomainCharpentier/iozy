# claude-lab

Projet d'entraînement pour l'examen **Claude Certified Developer – Foundations (CCDV-F)**. Il ne fait pas partie du produit : ni `backend/` ni `web/` ne l'utilisent, et il ne touche à aucune donnée réelle.

## Pourquoi

Le guide d'examen demande d'avoir construit et fait tourner au moins une application Claude : appel de l'API, outils, prompt et contexte, sécurité, évaluations. IozyCore n'en contient aucune. Ce lab comble ce manque sur la branche `learn/claude-code`, sans rien ajouter au produit (voir « Consolider plutôt qu'ajouter » dans le `CLAUDE.md` racine).

Le cas d'usage reste proche d'IozyCore : savoir si un tome d'une annonce est déjà possédé. Les données sont **inventées** (`src/sample-collection.ts`).

## Contenu (lot 1)

- `src/collection.ts` : modèle minimal d'une collection (série → éditions → tomes) et règles de recherche : sans casse ni accents, un titre partiel accepté s'il est unique, jamais de devinette entre plusieurs séries.
- `src/sample-collection.ts` : les données de démo.
- `src/mcp-server.ts` : serveur MCP en stdio avec deux outils en lecture seule, `owns_volume` et `list_missing_volumes`. Une série absente de la collection est une réponse normale ; un titre ambigu ou une édition inconnue sont renvoyés comme erreurs, avec de quoi corriger l'appel.
- `test/` : tests du domaine, et tests du serveur lancé pour de vrai et interrogé en stdio.

## Commandes

Node 24.2 ou plus. Depuis `claude-lab/` :

```bash
npm install
npm test            # sans réseau ni clé, moins d'une seconde
npm run typecheck
npm run mcp         # serveur MCP sur stdin/stdout
```

Node exécute les fichiers `.ts` directement (retrait des types) : pas d'étape de build. Les imports gardent donc leur extension `.ts`, et `tsconfig.json` interdit les syntaxes TypeScript qui ne s'effacent pas (`erasableSyntaxOnly`).

## Suite

Le plan par lots et la carte du programme d'examen sont dans `docs/CERTIF_CCDV-F.local.md` (note personnelle, ignorée par git). Prochain lot : une boucle d'outils avec l'API Messages, qui demandera une clé API dans `claude-lab/.env` (ignoré par git, jamais dans le code). Le branchement du serveur sur Claude Code viendra avec le lot 5.
