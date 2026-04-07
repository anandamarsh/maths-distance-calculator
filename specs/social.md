# Social Sharing & Comments

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

## Social CSS (defined in `index.css`)

All social CSS uses non-Tailwind classes.

### Launcher buttons (top-right cluster)

```css
.social-launchers { position: absolute; top: 0.9rem; right: 0.85rem; z-index: 61; }
.social-launcher  { /* inherits .arcade-button; 2.5rem × 2.5rem */ }
.social-launcher:hover, .social-launcher.is-active { transform: translateY(-2px); }
```

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
