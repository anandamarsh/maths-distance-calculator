# Automated Testing Guidelines

This file defines the autopilot contract for Trail Distance Calculator.
It is the repo-specific equivalent of the template app's `autopilot.md`.

The goal is to let the game play itself in a way that looks human:
- the dinosaur visibly moves along the trail before answering
- the keypad is pressed digit by digit
- level-complete report emails are sent through the existing UI
- the whole game can be demonstrated and tested end to end with one cheat code

## Cheat Codes

| Code | Action |
|------|--------|
| `198081` | Toggle autopilot on or off |
| `197879` | Fill the current correct answer and submit immediately |

Type digits consecutively on the keyboard. Non-digit keys reset the cheat buffer.
When a code matches, the final digit must not be inserted into the answer input.

## Autopilot Contract

### 1. Activation

1. Game is open.
2. User types `198081`.
3. Autopilot clears the current keypad value.
4. A green blinking robot icon appears in the top toolbar.
5. A green phantom hand becomes responsible for every automated interaction.

### 2. Playing A Question

For every new playable question:

1. Autopilot waits briefly, as if reading the prompt.
2. It drags the dinosaur along the exact route for the current question.
3. The drag must be visible, not an instant teleport.
4. The odometer must increase naturally in normal rounds.
5. After the drag is complete, autopilot waits briefly again.
6. It types the answer digit by digit on the keypad and presses submit.

### 3. Wrong-Answer Behaviour

Autopilot should not be perfect.

1. Roughly 20% of final submitted answers should be intentionally wrong.
2. Wrong answers must be plausible decimal misses, not random garbage.
3. Wrong answers count as genuine mistakes and may lose eggs.
4. Autopilot continues playing until the game still clears all rounds.

### 4. Level-Specific Rules

#### Level 1
- Drag the full route.
- Type the total distance.

#### Level 2
- Drag the full route.
- Type the missing leg distance.

#### Level 3 normal rounds
- Drag the route once.
- Answer the stepped prompts in order.
- For multi-step prompts, autopilot should continue from step to step without reloading the page.

#### Level 3 monster rounds
- Respect the monster announcement pause.
- If only the final comparison prompt is shown, answer that prompt directly.
- If the recovery scaffold is shown after a miss, continue through the revealed steps.

### 5. Level Complete

When the level-complete overlay is shown and the session report actions are visible:

1. Wait briefly as if reading the result.
2. Move the phantom hand to the email input.
3. Click the email input and clear it.
4. Type the configured autopilot email address character by character.
5. Move to the send button and click it.
6. Wait for the send action to complete.
7. If another level remains, click `Next Level`.
8. If the final level is complete, stop autopilot and leave the final completion overlay visible.

## Required Selectors

Interactive elements driven by autopilot must expose stable selectors:

- `data-autopilot-key="<digit>"` on keypad digits
- `data-autopilot-key="."` on the decimal button
- `data-autopilot-key="submit"` on the submit button
- `data-autopilot-key="email-input"` on the report email field
- `data-autopilot-key="email-send"` on the report email send button
- `data-autopilot-key="next-level"` on the level-advance button

## Visual Feedback

While autopilot is active:

- the robot icon remains visible and clickable to cancel
- the phantom hand shows drag movement and button presses
- manual tutorial hints should not visually conflict with autopilot guidance

## Cancellation

Autopilot can be stopped either by:

- clicking the robot icon
- typing `198081` again

Stopping autopilot must:
- clear all pending timers
- hide the phantom hand
- leave the game in its current playable state

## Playwright Scope

The Playwright path for this repo should verify:

1. `198081` enables autopilot and shows the icon
2. the dinosaur visibly moves before answer submission
3. the report email UI is filled and triggered automatically
4. autopilot advances through Level 1, Level 2, and Level 3
5. the final completion overlay is reached without manual interaction
