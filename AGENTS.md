# The Human Network Agent Guide

## Architecture

The Human Network is a static React/Vite SPA deployed on Netlify. It has no application backend: the browser calls the selected Lemmy instance directly, and private client preferences remain in `localStorage`.

## Key Directories

- `src/components/` contains screens, overlays, cards, and reusable UI.
- `src/lib/lemmy.ts` is the only Lemmy REST transport layer.
- `src/lib/format.ts` contains display helpers and comment-tree normalization.
- `src/store/useAppStore.ts` owns authentication state, local persistence, navigation, settings, and toasts.
- `src/types.ts` contains shared Lemmy and UI types.
- `public/` contains static Netlify-served files.

## Conventions

- Keep API calls in `src/lib/lemmy.ts`; components should not call `fetch` directly.
- Keep durable browser state namespaced with `swimmey:`.
- Use Tailwind utilities for component styling and CSS variables in `src/index.css` for theme tokens.
- Use Framer Motion springs with roughly `stiffness: 300` and `damping: 30` for tactile surfaces.
- Preserve button equivalents for every gesture and include useful ARIA labels.
- Treat read-only browsing as a first-class mode: voting, saving, and commenting require a JWT.
- Avoid adding server persistence unless product requirements explicitly change the privacy model.

## Non-obvious Decisions

- Lemmy v3 deployments differ in auth handling, so authenticated requests use the bearer header and legacy `auth` payload/query fields.
- Saved posts are loaded from and updated on the authenticated user's Lemmy instance; no saved-post IDs persist locally.
- Text-only posts use a deterministic title-to-hue gradient so they remain visually distinct without placeholder artwork.
- The app sends no analytics and needs no environment variables.

## Validation

The platform pipeline runs installation and production validation. For local work, use `npm run dev`; use `npm run build` before a manual release when permitted by the execution environment.
