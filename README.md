# Swimmey

Swimmey is a mobile-first, swipe-based Lemmy client. It turns a federated feed into a focused stack of tactile cards: swipe right to upvote, left to downvote, or tap through to the full post and threaded conversation.

## Highlights

- Direct connection to any user-provided Lemmy `/api/v3` instance
- JWT login with conditional two-factor authentication support
- Spring-based swipe gestures, directional feedback, haptics, and accessible action buttons
- Infinite post queue with scope filtering and all-time ranking
- Markdown post details, threaded comments, and authenticated commenting
- Lemmy-synced saved posts, with instance settings, filters, theme, and session state kept in the browser
- Threaded comment replies from the post conversation view
- Responsive light/dark design with reduced-motion support and loading skeletons
- Netlify SPA routing and security headers

## Technology

- React 18 and TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Zustand
- React Markdown
- Lucide icons

Swimmey intentionally uses `localStorage` rather than a server database. Credentials and personal preferences remain on the user’s device, while posts, votes, and comments go directly between the browser and the selected Lemmy instance.

## Local Development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Enter a Lemmy instance such as `lemmy.world`, then sign in or choose read-only browsing.

## Production Build

```bash
npm run build
```

The static output is written to `dist/`.

## Deploy to Netlify

1. Import this repository into Netlify.
2. Keep the detected build command as `npm run build`.
3. Keep the publish directory as `dist`.
4. Deploy. No environment variables are required.

`netlify.toml` includes the SPA fallback from `/*` to `/index.html`.

Expected site URL for this project: `https://zesty-pegasus-01a3a3.netlify.app`

## Lemmy Compatibility and CORS

The client sends authenticated requests using both the bearer header and the legacy `auth` field/query convention for broad `/api/v3` compatibility. Most Lemmy instances permit browser requests. If an instance blocks cross-origin traffic, Swimmey displays a friendly error recommending another instance or a small Netlify proxy function.

## Privacy Notes

- The instance URL and JWT are stored in the browser.
- Filters, theme, and haptic preferences are stored in the browser; saved posts remain on the user's Lemmy account.
- Credentials are submitted directly to the chosen Lemmy instance.
- Swimmey does not require an application account or server-side user database.
