# Split du repo en `app/` + `landing/`

Date : 2026-09-20
Statut : validé, prêt pour plan d'implémentation

## Objectif

Aujourd'hui l'application Next.js occupe la racine du repo. On veut :

- `app/` — l'application existante, déplacée telle quelle, déployée sur `app.clozer.club`
- `landing/` — un nouveau site marketing, déployé sur `www.clozer.club` (et `clozer.club`)

Contraintes : ne rien casser, ne rien perdre, garder la CI fonctionnelle et ses
checks requis valides.

## Décisions

### Deux packages indépendants, pas de workspace

`app/` et `landing/` ont chacun leur `package.json` et leur `package-lock.json`.
Aucun `package.json` à la racine du repo.

Alternatives écartées :

- **npm workspaces** — le hoisting des dépendances déplace `node_modules`, ce qui
  fragilise `scripts/copy-pdf-worker.mjs` (qui lit dans `node_modules/pdfjs-dist`)
  et la sortie de `prisma generate` vers `src/generated/prisma`. Gain nul ici :
  les deux applications ne partagent aucun code.
- **Turborepo / pnpm workspaces** — outillage dimensionné pour plusieurs packages
  avec code partagé. Deux applications isolées ne le justifient pas.

### Vercel : un projet par répertoire, via Root Directory

Le projet Vercel existant `closing_app` passe en Root Directory `app`. Un second
projet, sur le même repo GitHub, prend Root Directory `landing`. Tous les chemins
dans `vercel.json` et les scripts de build sont relatifs au Root Directory, donc
ils restent valides sans modification.

### CI : deux jobs, aucun filtre de chemin

Le job de l'application conserve l'identifiant `checks`, pour que toute branch
protection qui l'exige continue de fonctionner. Un job `landing` s'ajoute.

Pas de `paths:` sur les jobs : un job filtré qui est *skipped* ne publie jamais
son statut, ce qui bloque indéfiniment une PR dont ce check est requis. Le coût
est de quelques minutes de runner par PR.

## Arborescence cible

```
ClozerClub/
├── .github/workflows/
│   ├── ci.yml                  modifié : deux jobs
│   └── closing-tick.yml        inchangé
├── .gitignore                  patterns globaux, dé-ancrés
├── .personal-docs/             notes projet, reste à la racine
├── docs/                       reste à la racine
├── README.md                   index des deux packages
├── CLAUDE.md                   mis à jour
├── app/
│   ├── AGENTS.md
│   ├── .gitignore              générés propres à l'app
│   ├── package.json  package-lock.json  vercel.json
│   ├── next.config.ts  tsconfig.json  eslint.config.mjs  postcss.config.mjs
│   ├── vitest.config.mts  prisma.config.ts  trigger.config.ts  components.json
│   ├── .env.example
│   └── src/  prisma/  public/  scripts/  samples/
└── landing/
    ├── package.json  package-lock.json
    ├── next.config.ts  tsconfig.json  eslint.config.mjs  postcss.config.mjs
    └── src/app/               layout.tsx, page.tsx, globals.css
```

Fichiers non trackés à déplacer manuellement : `.env.local` et `.vercel/` vers
`app/`. `.next/` et `tsconfig.tsbuildinfo` sont supprimés, `node_modules/`
réinstallé dans chaque package.

## `.gitignore`

Le fichier actuel ancre ses patterns à la racine (`/node_modules`, `/.next/`,
`/src/generated/prisma`, `/public/pdf.worker.min.mjs`, `/coverage`, `/build`,
`/out`). Ces ancrages ne couvrent plus rien après le déplacement.

Répartition :

- **racine** — `node_modules/`, `.DS_Store`, `*.pem`, `.env*` (avec
  `!.env.example`), `.vercel`, `*.tsbuildinfo`, `next-env.d.ts`, les logs de
  debug, les patterns `.yarn/` et `.pnp`
- **`app/.gitignore`** — `/.next/`, `/out/`, `/build`, `/coverage`,
  `/src/generated/prisma`, `/public/pdf.worker.min.mjs`, `.trigger`
- **`landing/.gitignore`** — `/.next/`, `/out/`, `/build`

## CI

`ci.yml` déclenché comme aujourd'hui (push sur `main`, toute pull request).

Job `checks` — `working-directory: app` via `defaults.run` :

1. `actions/checkout@v4`
2. `actions/setup-node@v4`, node 22, `cache: npm`,
   `cache-dependency-path: app/package-lock.json`
3. `npm ci`
4. `npx next typegen`
5. `npm run typecheck`
6. `npm run lint`
7. `npm test`

Job `landing` — `working-directory: landing`, mêmes trois premières étapes avec
`cache-dependency-path: landing/package-lock.json`, puis `npm run typecheck`,
`npm run lint`, `npm run build`. Pas de `npm test` : le package n'a pas de suite
de tests, la commande échouerait.

Les deux jobs tournent en parallèle.

`closing-tick.yml` ne fait qu'un `curl` vers `$APP_URL/api/cron/closing` et ne
lit aucun fichier du repo : aucune modification.

## Vercel

| Projet | Root Directory | Domaines |
|---|---|---|
| `closing_app` (existant) | `app` | `app.clozer.club` |
| nouveau projet landing | `landing` | `www.clozer.club`, `clozer.club` en redirection vers `www` |

Les variables d'environnement de `closing_app` sont inchangées — c'est le même
projet, seul son Root Directory bouge.

Option à activer sur les deux projets : « Only build if there are changes in the
Root Directory ». Sans elle, chaque push redéploie les deux projets.

### Ordre d'exécution

1. Passer Root Directory de `closing_app` à `app` dans le dashboard Vercel.
2. Pousser la branche de restructuration. Le preview deploy de la PR doit passer.
3. Merger.
4. Créer le projet landing et y attacher les domaines.

Entre l'étape 1 et l'étape 3, un redéploiement de `main` échouerait, faute de
`package.json` à la racine sur cette branche. La production reste en ligne : un
build Vercel en échec laisse actif le déploiement précédent.

## Landing : périmètre du scaffold

Une application Next 16 minimale, même stack que `app/` pour éviter deux
écosystèmes : TypeScript, Tailwind 4 via `@tailwindcss/postcss`,
`eslint-config-next`. Une seule route `/` affichant une page d'attente.

Scripts : `dev`, `build`, `start`, `lint`, `typecheck`. Pas de `test`.

Le contenu marketing réel fait l'objet d'un travail séparé.

## Documentation à mettre à jour

- `CLAUDE.md` racine — section Commands préfixée par `cd app`, description de
  l'arborescence en deux packages
- `AGENTS.md` — déplacé dans `app/`, puisque `next dev` le régénère à la racine
  du projet Next
- `.personal-docs/e2e/flow.mjs` ligne 6 — le chemin absolu vers
  `samples/devis-exemple.pdf` devient `app/samples/devis-exemple.pdf`
- `.personal-docs/README.md`, `01-etat-des-lieux.md`, `03-exploitation.md` —
  nouvelle arborescence
- `README.md` racine — index pointant vers les deux packages

## Préservation de l'historique

Chaque chemin tracké est déplacé avec `git mv`. Git détecte les renommages, donc
`git log --follow` continue de remonter l'historique de chaque fichier.

## Vérification

Depuis `app/` : `npm ci`, `npx next typegen`, `npm run typecheck`,
`npm run lint`, `npm test`, `npm run build`.

Depuis `landing/` : `npm ci`, `npm run typecheck`, `npm run lint`,
`npm run build`.

La CI doit être verte sur la PR, et le preview deploy Vercel de l'application
doit aboutir une fois le Root Directory modifié.

## Piège découvert pendant l'implémentation

Next 16 cherche le App Router à `<racine du paquet>/app` **avant**
`<racine du paquet>/src/app`. Le paquet s'appelant lui-même `app/`, tout outil
qui écrit sous un chemin relatif au repo (`app/…`) depuis l'intérieur du paquet
crée `app/app/`. Next y voit alors un App Router vide : `next typegen` continue
d'afficher « ✓ Types generated successfully » mais écrit
`type AppRoutes = never`, et `tsc` échoue sur chaque `PageProps`,
`LayoutProps` et `RouteContext` avec `TS2344 … does not satisfy the constraint
'never'`.

C'est arrivé pendant cette migration, un hook ayant déposé un `CLAUDE.md` dans
`app/app/`. La CI n'est pas concernée — son checkout est propre — mais le piège
se reproduira en local. Il est documenté dans `CLAUDE.md` et dans
`.personal-docs/04-decisions-et-pieges.md`.

Renommer le paquet en `web/` ou `product/` supprimerait la classe d'erreur, au
prix de l'écart avec le sous-domaine `app.clozer.club`.
