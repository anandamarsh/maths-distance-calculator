# maths-distance-calculator Embedded Storage Spec

## Role

Use parent-owned storage when embedded, with local `localStorage` as the
standalone and timeout fallback.

## Migrations

- `maths-distance-calculator:youtube-bubble-dismissed`
  -> `interactive-maths:youtubeBubbleDismissed`
- `reportName`
  -> `interactive-maths:reportName`
- `reportEmail`
  -> `interactive-maths:reportEmail`
- `lang`
  -> `interactive-maths:locale`

## Runtime Rules

- Read through `postMessage` when framed.
- Cache resolved shared values locally for fallback and standalone mode.
- Promote legacy local values into the shared key on first load.
- Do not access `window.parent.localStorage`.

## Verification

- Dismiss the YouTube bubble in the iframe, reload, confirm it stays hidden.
- Enter report name/email in the iframe, open another embedded app, confirm the
  same values appear.
- Change language in the iframe, reload, confirm the parent-backed locale stays
  selected.
