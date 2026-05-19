# ADSEUM

Marketing- en CMS-site voor ADSEUM (Empowering Queer Art). Statische site gehost op Firebase Hosting, met een lichte in-browser CMS bovenop Firestore.

## Tech stack

- **Hosting**: Firebase Hosting (`firebase.json` → `public/` als webroot)
- **Database / auth**: Firebase Firestore + Firebase Auth (Google sign-in)
- **Styling**: Tailwind CSS (gebouwd naar `public/output.css`) + handgeschreven `public/style.css`
- **Animaties**: GSAP + ScrollTrigger (via CDN, version-pinned)
- **JS**: Vanilla ES modules in de browser — geen bundler

## Mappenstructuur

```
public/                  # alles wat naar Firebase Hosting gaat
  index.html             # publieke site
  admin.html / admin.js  # CMS — content beheren
  builder.html / builder.js  # CMS — letter/dot-grafiek editor
  login.html / login.js  # Google sign-in voor CMS
  firebase-config.js     # Firebase init (zie "Geheimen" hieronder)
  modules/               # gedeelde JS-modules
    animations.js        # GSAP-animaties
    auth-guard.js        # CMS-route bewaking
    admin-access.js      # admin lookup in Firestore
    database.js          # Firestore reads/writes
    renderer.js          # dot-grid render
    dot.js               # losse dot-SVG factory
    config.js            # constants
  fonts/                 # custom fonts
  style.css              # handgeschreven CSS (alle scopes)
  output.css             # gegenereerd door Tailwind — NIET met de hand bewerken
src/
  input.css              # Tailwind entrypoint (importeert style.css)
firestore.rules          # Firestore security rules
firestore.indexes.json   # Firestore indexen
firebase.json            # Firebase Hosting + Firestore config
.firebaserc              # Firebase-project alias (default: adseum-53dcd)
preview-server.js        # lokale dev-server (statisch, geen reload)
tailwind.config.js       # Tailwind content-scan paths
eslint.config.js         # ESLint flat config
.prettierrc.json         # Prettier config
.editorconfig            # Editor indentatie/EOL
.github/workflows/       # CI: deploy-preview + deploy-live
```

## Lokaal draaien

Vereist: Node 18+ (zie `.nvmrc`).

```bash
npm install
npm run build:css         # genereert public/output.css
npm run serve             # serveert public/ op http://localhost:4175
```

In een tweede terminal — als je Tailwind classes wijzigt — draai een watcher:

```bash
npm run watch:css
```

## Deploy

CI deployt automatisch:
- **Preview-channel** op elke push naar een non-`main` branch (`.github/workflows/deploy-preview.yml`)
- **Live** bij push naar `main` (`.github/workflows/deploy-live.yml`)

Beide workflows hebben een `FIREBASE_TOKEN` repo-secret nodig. Genereer met:

```bash
npx firebase-tools login:ci
```

en zet de output in **GitHub → Settings → Secrets → Actions → FIREBASE_TOKEN**.

Handmatig deployen:

```bash
npm run deploy            # build:css + firebase deploy --only hosting
```

## CMS

Op `/admin` (vereist Google sign-in met een toegestaan e-mailadres).
Toegestane e-mails staan in Firestore: `admins/{email}`.

De eigenaar (`jareerink@gmail.com`) staat hardcoded in `firestore.rules` en kan
andere admins toevoegen via `/admin`.

## Geheimen

`public/firebase-config.js` bevat de publieke Firebase web-config (apiKey enz.).
Dit is **opzettelijk** publiek — Firebase web API keys identificeren alleen het
project en zijn niet geheim. De daadwerkelijke security zit in `firestore.rules`.

Zie de [Firebase docs over API keys](https://firebase.google.com/docs/projects/api-keys).

## Codestijl

- ESLint config: `eslint.config.js` (flat config)
- Prettier config: `.prettierrc.json` + `.prettierignore`
- Editor: `.editorconfig` voor consistente indentatie

Run lokaal:

```bash
npm run lint              # eslint over public/**/*.js
npm run format            # prettier --write
```

## Open punten

- `script.js` is groot en mag verder opgesplitst worden (nav / hero / sections / locale).
- `style.css` mengt nog admin/builder/site styles; per scope splitsen is wenselijk.
- Tests: er zijn er nog geen.
