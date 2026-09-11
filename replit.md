# Running on Replit

This project is a React 18 and TypeScript single-page app served by Vite.

## Run

Use the **Start application** workflow. It runs:

```bash
npm run dev
```

Vite is configured to listen on `0.0.0.0:5000` and accept Replit's proxied preview host.

## Validation

Run `npm run build` to type-check the project and create the production bundle in `dist/`.

## Services

No database, application server, environment variables, or secrets are required. The browser communicates with the Lemmy instance selected by the user. During development, Vite exposes `/api/lemmy` as a proxy for instances that reject cross-origin browser requests.