# Social Sharing, Comments & Video

**File:** `src/components/Social.jsx` (+ `Social.d.ts` for TypeScript types)

---

## `SocialShare` component

Renders a row of share buttons for Twitter, Facebook, WhatsApp, and LinkedIn.
Uses the `react-share` library.

```tsx
export function SocialShare(): JSX.Element
```

Share URL: `"https://www.seemaths.com"`
Share title: `"Play Distance Calculator — a free interactive maths game!"`

Displayed in a slide-down drawer when the Share button is pressed.

---

## `SocialComments` component

Embeds a DiscussIt iframe for in-game comments (via `disqus-react`).

```tsx
export function SocialComments(): JSX.Element
```

Renders an iframe pointing to the DiscussIt comment widget.
The iframe fills a scrollable `.social-comments-shell` container.

---

## `openCommentsComposer()`

```ts
export function openCommentsComposer(): void
// Posts a postMessage to the DiscussIt iframe to open its compose area.
```

Called by the "Add Comment" button in the comments drawer header.

---

## YouTube walkthrough launcher

The launcher cluster also includes a YouTube icon button when `public/manifest.json`
contains a valid `videoUrl`.

Behaviour:
- The button sits next to the existing share/comments launchers.
- The launcher button matches the `see-maths` YouTube treatment: transparent background,
  yellow circular border, centered YouTube logo.
- The screen fetches `/manifest.json` on mount, reads `videoUrl`, and converts it to a
  YouTube embed URL.
- Supported URL forms include `youtu.be`, standard YouTube watch URLs, and Shorts URLs.

### First-time speech bubble

The speech bubble should be positioned relative to the YouTube icon so the full bubble
stays visible inside the viewport.

Placement rule:
- If there is enough space above the icon, the bubble may render above it.
- If there is not enough space above, the bubble should render below it.
- The chosen position should prevent the bubble from being clipped off-screen.
- The pointer tail should flip to the edge that faces the icon.

Distance Calculator note:
- In this project the launcher sits near the top edge, so the bubble is rendered below
  the icon.

Bubble content:
- leading circular YouTube icon inside the bubble
- copy comes from i18n key `social.youtubePrompt`
  - English source text: `First time? Look at a video on how to play.`
- dismiss action comes from i18n key `social.youtubeDismiss`
  - English source text: `Don't show again`

Dismissal rules:
- Clicking the dismiss action hides the bubble.
- Bubble dismissal is persisted in `localStorage` under:

```ts
"maths-distance-calculator:youtube-bubble-dismissed"
```

- The YouTube icon remains visible after dismissal.

### Video modal

Pressing the YouTube icon opens a centered modal player.

Modal rules:
- Width: `80vw`
- Height: `80vh`
- Centered with `transform: translate(-50%, -50%)`
- Contains an embedded YouTube `<iframe>`
- Includes a top-right close button with:
  - red circular background
  - white Material UI `Close` icon
- The close button circle is positioned so its centre aligns with the modal corner
- Clicking the darkened backdrop also closes the modal
- The iframe uses the embed URL derived from `manifest.json` `videoUrl`

---

## Social CSS (defined in `index.css`)

All social CSS uses non-Tailwind classes.

### Launcher buttons (top-right cluster)

```css
.social-launchers { position: absolute; top: 0.9rem; right: 0.85rem; z-index: 61; }
.social-launcher  { /* inherits .arcade-button; 2.5rem × 2.5rem */ }
.social-launcher:hover, .social-launcher.is-active { transform: translateY(-2px); }
```

### YouTube CTA

```css
.social-video-cta {
  position: relative;
  display: flex;
  align-items: flex-end;
}

.social-video-button {
  width: 2.7rem;
  height: 2.7rem;
  padding: 0;
  background: transparent;
  border: 3px solid #fef08a;
  border-radius: 9999px;
}

.social-video-bubble {
  position: absolute;
  right: 0;
  top: calc(100% + 0.8rem);
  width: 310px;
  max-width: 310px;
}
```

Reusable placement guidance:
- Bubble width remains `310px` on mobile and desktop.
- Render it above or below the icon depending on available space.
- Move the tail to the edge nearest the icon.

### Share drawer (slides down from top-right)

```css
.social-share-drawer {
  top: 0; right: 0;
  transform: translateY(-1.1rem);
  border-radius: 0 0 0 1.15rem;
  min-width: 19rem;
}
.social-drawer.is-open { transform: translateY(0); opacity: 1; }
```

### Comments drawer (slides up from bottom)

```css
.social-comments-drawer {
  left: 0; right: 0; bottom: 0;
  width: 100vw; height: 70vh;
  border-top: 1px solid rgba(250,204,21,0.46);
  transform: translateY(calc(100% + 1.25rem));
}
```

Mobile landscape: `height: 100dvh`.

---

## Wiring in the screen

The screen manages two drawer state variables:

```ts
const [showShareDrawer, setShowShareDrawer] = useState(false);
const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
```

Share button in toolbar → `setShowShareDrawer(o => !o)` (or `navigator.share` if available).
Comments button → `setShowCommentsDrawer(o => !o)`.
YouTube button → `setYoutubeModalOpen(true)` when a valid `videoUrl` exists.
