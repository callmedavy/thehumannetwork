# The Human Network Agent Guide

## Architecture

The Human Network is a static React/Vite SPA deployed on Netlify. It has no application backend: the browser calls the selected Lemmy instance directly, and private client preferences remain in `localStorage`.

## Key Directories

- `src/components/` contains screens, overlays, cards, and reusable UI.
- `src/lib/lemmy.ts` is the only Lemmy REST transport layer.
- `src/lib/readSet.ts` is the device-local read set: the browser's own record of posts the reader has marked read.
- `src/lib/format.ts` contains display helpers and comment-tree normalization.
- `src/store/useAppStore.ts` owns authentication state, local persistence, navigation, settings, and toasts.
- `src/types.ts` contains shared Lemmy and UI types.
- `scripts/` holds standalone invariant runners (`npm run verify:read-set`, `npm run verify:weekly-top`): each transpiles the real module with the repo's TypeScript and exercises it without a browser.
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
- Read filtering is enforced in the browser by `src/lib/readSet.ts`, keyed on `post.ap_id`. The server-side `show_read=false` flag only covers signed-in readers on instances new enough to honour it (0.19.4+), and it cannot affect a post already sitting in the feed queue — so the device-local set is what keeps a read post from coming back for anonymous readers, on older instances, and within the current deck.
- Saved posts are loaded from and updated on the authenticated user's Lemmy instance; no saved-post IDs persist locally.
- Text-only posts use a deterministic title-to-hue gradient so they remain visually distinct without placeholder artwork.
- The Weekly Top 10 chart cannot ask Lemmy for a calendar week: v3 has no `from`/`to` filter, and `TopWeek` means the seven days before *now*. A week is reconstructed instead by walking the narrowest relative top-sort window that contains it (`TopMonth`, then `TopYear`, then `TopAll`) and keeping the posts published inside it. Those rankings are score-ordered, so the walk stops as soon as the tenth post in hand beats the last page's floor, and reports `capped` when it runs out of pages without proving the top ten.
- The app sends no analytics and needs no environment variables.

## Validation

The platform pipeline runs installation and production validation. For local work, use `npm run dev`; use `npm run build` before a manual release when permitted by the execution environment. `npm run verify:read-set` checks the read-set invariants (ap_id keying, reload persistence, cap, quota handling) without a browser. `npm run verify:weekly-top` checks the Weekly Top 10 windows (Sunday boundaries, month and year straddles, DST) and the paging walk (early stop, page cap, ranking, cross-posts, credentials) against canned pages — no browser, no network.
