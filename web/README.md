# RAG Preceptra — Web App

Next.js (App Router) frontend for the **RAG Preceptra** project.

For the full repo overview (including Supabase local dev), see the root `README.md`.

## Tech stack (current)

- **Next.js**: 16.0.8
- **React**: 19.2.1
- **TypeScript**: ^5
- **Styling**: CSS Modules + global CSS
- **React Compiler**: enabled via `reactCompiler: true` in `next.config.ts`

## Scripts

```bash
npm run dev     # http://localhost:3000
npm run build
npm run start
npm run lint
```

## Project structure (current)

```ini
web/
├── src/
│   └── app/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── globals.css
│       └── page.module.css
├── public/
├── next.config.ts
├── eslint.config.mjs
└── tsconfig.json
```

## Environment variables

Create `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

If you're running Supabase locally, you can get the keys via:

```bash
supabase status
```

## Current status

- Frontend scaffold is in place (App Router + basic landing page).
- Supabase is not yet wired into the app (no auth, storage, or RAG flows implemented in `web/` yet).
