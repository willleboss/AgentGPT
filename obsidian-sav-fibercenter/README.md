# SAV FiberCenter Tracker (plugin Obsidian)

Plugin Obsidian pour automatiser le suivi, le déclenchement et la clôture des
SAV FTTH dans **FC2 (FiberCenter)** en croisant les statuts et annotations
relevés chez les mainteneurs **R&C (Praxedo)** et **Circet (GoPaaS)**.

- FC2 : `https://newfibercenter.lumiere.fr/#/tickets`
- R&C : `https://rcgroupe.praxedo.com/`
- Circet : `https://circet-fr.gopaas.net/sav/index.php`

⚠️ **Ce plugin fonctionne uniquement sur Obsidian desktop** (il pilote une
fenêtre Electron cachée pour gérer l'authentification par session/cookies).
Il ne fonctionnera pas sur Obsidian mobile.

## État du projet : squelette fonctionnel, connecteurs à finaliser

Ce plugin compile et se charge correctement dans Obsidian, mais **je n'ai
pas pu accéder à vos 3 outils internes/mainteneurs** (accès authentifiés,
réseau d'entreprise) pour repérer les vrais sélecteurs de formulaires et de
tableaux. Les fichiers `src/connectors/*.ts` contiennent donc des
sélecteurs **génériques/placeholders**, clairement marqués `// TODO`, à
ajuster une fois testés sur les vraies pages. Le mode debug (voir plus bas)
est fait pour vous permettre de les compléter vous-même en quelques minutes,
ou de me transmettre les infos manquantes pour que je les finalise.

## Installation

1. Prérequis : Node.js 18+ installé sur votre PC.
2. Dans ce dossier :
   ```bash
   npm install
   npm run build
   ```
   Cela génère `main.js` à la racine du dossier.
3. Copiez (ou liez) tout le dossier `obsidian-sav-fibercenter` dans
   `<votre-vault>/.obsidian/plugins/sav-fibercenter-tracker/` — il doit
   contenir au minimum `manifest.json`, `main.js`, et `versions.json`.
4. Dans Obsidian : **Réglages → Plugins communautaires** → activer
   « SAV FiberCenter Tracker ».
5. Ouvrez les réglages du plugin et renseignez vos identifiants pour les 3
   sites (FC2, R&C/Praxedo, Circet/GoPaaS).

## Sécurité — à lire avant utilisation

- Les identifiants saisis dans les réglages sont enregistrés **en clair**
  dans `.obsidian/plugins/sav-fibercenter-tracker/data.json`. Ce fichier est
  exclu du dépôt git (`.gitignore`) — ne le committez jamais et ne le
  partagez pas.
- N'utilisez ce plugin qu'avec des comptes auxquels vous avez un accès
  professionnel légitime, dans le cadre autorisé par votre entreprise.
  Évitez un vault synchronisé sur un service cloud que vous ne maîtrisez pas
  si vous y stockez des identifiants.

## Finaliser les connecteurs (étape indispensable)

Chaque site a ses propres sélecteurs HTML (login, tableau des tickets,
formulaire de déclenchement/clôture SAV) que je ne peux pas deviner sans y
accéder. Pour les compléter :

1. Dans les réglages du plugin, activez **« Mode debug (afficher le
   navigateur) »**.
2. Lancez la commande **« SAV FiberCenter Tracker: Synchroniser les tickets
   SAV »** (palette de commandes `Ctrl/Cmd+P`, ou l'icône dans la barre
   latérale). Une fenêtre de navigateur s'ouvre, visible, avec les DevTools.
3. Observez pourquoi la connexion ou la lecture échoue (message d'erreur
   affiché en notification), inspectez le vrai formulaire/tableau dans les
   DevTools (onglet Elements pour les sélecteurs CSS, onglet Network pour
   repérer d'éventuels appels API JSON plus simples à consommer qu'un
   scraping DOM).
4. Ajustez les sélecteurs dans le fichier concerné :
   - `src/connectors/fc2.ts` (login, `listTickets`, `declencherSav`,
     `cloturerSav`)
   - `src/connectors/praxedo.ts` (login, `listTickets`)
   - `src/connectors/gopaas.ts` (login, `listTickets`)
5. Relancez `npm run build`, puis re-testez.

**Astuce Praxedo** : R&C utilise Praxedo, un logiciel SaaS qui propose
généralement une vraie API REST documentée (clé API). Si vous pouvez
obtenir cet accès auprès de R&C/Praxedo, remplacez le scraping dans
`praxedo.ts` par de simples appels HTTP via `requestUrl` (API Obsidian) —
ce sera beaucoup plus fiable qu'un pilotage de page.

Si vous préférez, vous pouvez aussi me transmettre :
- le HTML de la page de connexion et du tableau des tickets de chaque site
  (clic droit → Afficher le code source, ou export depuis les DevTools), ou
- les requêtes réseau observées (onglet Network, format HAR),

et je finaliserai les sélecteurs/endpoints directement dans le code.

## Fonctionnement

- Commande **« Synchroniser les tickets SAV (FC2 + mainteneurs) »** :
  1. Connexion aux 3 sites (session Electron dédiée par site).
  2. Lecture des tickets FC2 et des interventions R&C/Circet.
  3. Rapprochement par identifiant de ticket.
  4. Création/mise à jour d'une note par ticket dans le dossier configuré
     (par défaut `SAV FTTH/`), avec :
     - un frontmatter (`ticket_id`, `mainteneur`, `statut_fc2`,
       `statut_mainteneur`, `derniere_sync`) exploitable avec Dataview pour
       un tableau de bord,
     - un journal chronologique des synchronisations (statuts + annotations
       relevées) en bas de note.
- Les méthodes `declencherSav` / `cloturerSav` du connecteur FC2 sont prêtes
  à être appelées (depuis une commande dédiée à ajouter, ou automatiquement
  selon une règle métier) une fois leurs sélecteurs finalisés — elles ne
  sont pas encore reliées à une commande pour éviter toute clôture
  accidentelle avant validation manuelle des sélecteurs.

## Structure du projet

```
obsidian-sav-fibercenter/
├── manifest.json          # métadonnées du plugin Obsidian
├── package.json / tsconfig.json / esbuild.config.mjs
├── src/
│   ├── main.ts             # point d'entrée du plugin, commandes
│   ├── settings.ts         # réglages (identifiants, dossier, mode debug)
│   ├── sync.ts              # moteur de synchronisation + écriture des notes
│   └── connectors/
│       ├── browserSession.ts  # fenêtre Electron cachée (auth par cookies)
│       ├── fc2.ts              # FC2 (login, tickets, déclenchement/clôture)
│       ├── praxedo.ts          # R&C / Praxedo (login, tickets)
│       ├── gopaas.ts           # Circet / GoPaaS (login, tickets)
│       └── types.ts
└── README.md
```
