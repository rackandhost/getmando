# App Status Check — Delta for UI Redesign

Presentation change only: polling, endpoint, retry and server requirements are untouched.

## MODIFIED Requirements

### Requirement: Status badge is accessible

The status badge MUST NOT convey up/down by colour alone (WCAG 1.4.1) and MUST expose the state to
assistive technology. The badge is a pill in the card's header row containing a status dot and a text
label — `UP` or `DOWN` — in IBM Plex Mono 11 px; the **text label is the non-colour cue**. The badge
element itself is decorative (`aria-hidden`); the state is carried in the app card's accessible name (`<name>, online` / `<name>, offline`).
Colours MUST come from the `--up`/`--up-bg` and `--down`/`--down-bg` tokens and meet 4.5:1 in both
themes at the worst-case backdrop defined by `design-system` (card surface with its legibility floor). Apps without `healthCheck`, or with no result yet, MUST NOT render a badge.

(Previously: a circular corner badge distinguished by a check vs cross glyph.)

#### Scenario: State is in the accessible name

- GIVEN a monitored app whose last check was `up`
- WHEN a screen reader reads the app card's activator
- THEN its accessible name is `<name>, online` (or `<name>, offline` when the last check was `down`)

#### Scenario: Non-colour visual cue

- GIVEN two monitored apps, one `up` and one `down`
- WHEN their badges are rendered
- THEN the badges show different text (`UP` vs `DOWN`), not only a different colour

#### Scenario: Unmonitored app

- GIVEN an app without `healthCheck`
- WHEN its card renders
- THEN no badge is shown

#### Scenario: Contrast

- GIVEN the `up` and `down` badges in each theme
- WHEN contrast of label against badge background is measured
- THEN each is at least 4.5:1
