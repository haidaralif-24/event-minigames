# Completed Setup

## What was built
- `src/main.jsx`, `src/App.jsx` — React entry + router (`/host`, `/play`, `/board`)
- `src/pages/*.jsx` — three route pages
- `src/index.css` — Tailwind theme variables per `THEME.md`
- `vite.config.js` — Vite + React + Tailwind plugin
- `src/content/test-night/` — first content pack (`meta.json`, `questions.json`, `README.md`)
- `src/content/README.md` — pack format spec
- `src/data/constants.js` — `ACTIVE_EVENT`, event imports, team colors
- `.env` — placeholder `VITE_FIREBASE_*` variables
- `src/pages/Login.jsx` — root `/` login screen (host password `Dadarzz` via `localStorage`)
- `src/pages/Host.jsx` — host renders board like spectator (leaderboard/controls deferred)
- `public/favicon.svg` — favicon

## Beginner Firebase Tutorial

1. Go to https://console.firebase.google.com/ and click "Create a project".
2. When the project is created, click the web icon (`</>`) to add a web app. Copy the config.
3. In your Firebase console, go to Firestore Database → Create database → Start in test mode.
4. In the web app config, find the keys (`apiKey`, `authDomain`, `projectId`, etc.).
5. Copy them into `.env` as `VITE_FIREBASE_*` variables (see `.env` file).
6. For local dev: `cp .env .env.local` and fill in real values.
7. For Firebase Hosting: run `npm run build`, then `firebase deploy --only hosting`. The `VITE_FIREBASE_*` variables are baked into `dist/` at build time.

## Auth Note
Root `/` is a login screen. Host must enter `Dadarzz` to access `/host`, `/play`, `/board`. Routes redirect to `/` without it (`localStorage` check). Team word-for-numbers auth is deferred.
