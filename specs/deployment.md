# Deployment & PWA

---

## Environment variables

### `.env.local` (development)

```
RESEND_API_KEY=re_...                      # email delivery via /api/send-report
EMAIL_FROM=noreply@yourdomain.com          # verified Resend sender address
OPENAI_API_KEY=sk-...                      # on-demand translation (planned)
VITE_AUTOPILOT_EMAIL=your@email.com        # email autopilot fills in during tests
```

Vite's `localApiPlugin()` in `vite.config.ts` reads `.env.local` manually and
populates `process.env` for the dev middleware.

### Vercel (production)

Set the same vars in Vercel project settings:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `OPENAI_API_KEY` (when i18n is implemented)

Vercel auto-discovers `api/*.ts` as serverless functions.

---

## Vercel config (`vercel.json`)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "frame-ancestors *" },
        { "key": "Permissions-Policy",      "value": "web-share=*" },
        { "key": "X-Frame-Options",         "value": "ALLOWALL" }
      ]
    }
  ]
}
```

These headers allow the game to be embedded in iframes from any origin and
enable the Web Share API from within iframes.

---

## PWA (`public/manifest.json`)

```json
{
  "name": "Trail Distance Calculator",
  "short_name": "Distance",
  "description": "An interactive maths game for decimal distance problems",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#020617",
  "theme_color": "#0d1b35",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Manifest version stamping

`scripts/stamp-manifest.mjs` runs before the Vite build (`prebuild` hook) to
inject a version/build-timestamp field into `manifest.json`, then restores the
original file after the build (`postbuild` hook). This allows the PWA to detect
new deployments and prompt for updates without requiring cache-busting hacks.

### Service worker

`vite-plugin-pwa` with `registerType: 'autoUpdate'` generates a service worker that:
- Pre-caches all `*.{js,css,html,ico,png,svg,woff,woff2}` files
- Uses NetworkFirst for all HTTPS requests (10s timeout, falls back to cache)

---

## Rotate prompt (`src/components/RotatePrompt.tsx`)

Shown when: touch device in **portrait** orientation.

Renders a full-screen overlay with:
- Rotating SVG phone icon animation
- "Rotate your device"
- "This game plays best in landscape mode"

Attempts to lock screen orientation to landscape on mount:
```ts
screen.orientation?.lock?.("landscape").catch(() => {})
```

If embedded in an iframe, also posts a message to the parent:
```ts
window.parent.postMessage({ type: "request-landscape" }, "*");
```

---

## Playwright test config (`playwright.config.ts`)

```ts
{
  testDir: './tests',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4001',
    viewport: { width: 1280, height: 800 },
    headless: false,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4001',
    reuseExistingServer: !process.env.CI,
  },
}
```

---

## Build & deploy

```bash
npm run dev          # dev server on localhost:4001 with live API middleware
npm run build        # stamp manifest → TypeScript check → Vite bundle → restore manifest
npm run preview      # serve dist/ locally
npm run test:autopilot  # Playwright end-to-end tests
```

Push to main → Vercel auto-deploys. Serverless functions in `api/` are deployed
alongside the static site.

## Touch menu policy

During local development on `localhost`, `127.0.0.1`, or `::1`, the app leaves the
browser's standard right-click and long-press menus enabled so debugging tools and
normal inspect/copy workflows still work.

In production and any non-local host, the app disables the default `contextmenu`
surface and iOS touch callout on the game shell, while still allowing normal text
selection behavior inside editable controls.

---

## Icon requirements

| File | Size | Usage |
|------|------|-------|
| `public/favicon.ico` | any | browser tab |
| `public/favicon.svg` | scalable | browser tab (modern) + PDF icon |
| `public/apple-touch-icon.png` | 180×180 | iOS home screen |
| `public/icon-192.png` | 192×192 | Android PWA |
| `public/icon-512.png` | 512×512 | PWA splash + PDF fallback |

The PDF generator (`generatePdf.ts`) tries `/favicon.svg` first, falls back to
`/icon-512.png` if SVG rendering fails.
