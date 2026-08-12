# Spotter Web

Frontend di Spotter — web app che collega personal trainer e atleti.
Il PT vede sessioni, carichi e progressi dei propri clienti.

## Stack

- React 19, TypeScript 6 (strict mode), Vite 8
- Tailwind CSS v4 — no `tailwind.config.js`, solo `@import "tailwindcss"` in `src/index.css`
- axios per le chiamate HTTP
- Il backend è un progetto separato (spotter-api): Spring Boot 3, Java 21, JWT Bearer, PostgreSQL

## Comandi

- `npm run dev` — dev server (richiede `VITE_API_URL` in `.env.local`, vedi `.env.example`)
- `npm run build` — type-check + build di produzione
- `npm run lint` — ESLint
- `npx tsc -b --noEmit` — type-check senza build

## Struttura cartelle

Organizzazione per feature, non per tipo di file:

```
src/
  api/          # Client axios e funzioni di chiamata API
    client.ts   # Istanza axios, interceptor token e 401
    auth.ts     # login(), getCurrentUser()
  auth/         # Logica di autenticazione React
    AuthContext.tsx  # Provider con user, loading, login, logout
    useAuth.ts      # Hook per consumare il context
  types/        # Tipi TypeScript che rispecchiano i DTO Java
    auth.ts
  pages/        # Componenti pagina (uno per rotta)
    LoginPage.tsx
```

Quando aggiungi una nuova feature, crea la sua cartella sotto `src/` con i propri
componenti, hook, tipi e funzioni API. Non raggruppare per tipo (es. tutti gli hook
in `src/hooks/`, tutti i componenti in `src/components/`).

## Flusso di autenticazione

1. `AuthProvider` (mount) — se c'è un token in `localStorage`, chiama `GET /api/users/me`
   per ripristinare la sessione. Mostra `loading=true` durante il tentativo.
2. Login — `POST /api/auth/login` → salva il token → `GET /api/users/me` → setta `user`
3. Interceptor request — aggiunge `Authorization: Bearer <token>` a ogni richiesta
4. Interceptor response — su 401 (escluse rotte `/api/auth/**`): rimuove il token,
   redirect a `/` con reload completo per stato pulito
5. Logout — rimuove il token da `localStorage`, setta `user=null`

Il token è in `localStorage` con chiave `spotter_token`.

## Convenzioni

- TypeScript strict, niente `any`
- Solo Tailwind per lo styling, niente file CSS separati. Palette `stone`, tema dark.
- Commenti nel codice in inglese, solo quando il perché non è ovvio
- Conventional commits (es. `feat:`, `fix:`, `chore:`)
- Mai `dangerouslySetInnerHTML`

## Deploy

- Frontend su Vercel
- Backend su Render
- La variabile `VITE_API_URL` punta al backend deployato in produzione

## Vincoli

- Non toccare il backend: se serve una modifica lato API, segnalala senza implementarla
- Organizzazione per feature, non per tipo
- Validazione client coerente con le regole del backend
