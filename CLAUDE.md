# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

PhysiQ-Jump is a video-based vertical jump height analyzer for physiotherapy. The physiotherapist records the jump on video, then marks the takeoff and landing frames; jump height is derived from flight time using the standard ballistic formula. Results are shared to the shared PhysiQ session in real time via BroadcastChannel.

**Deployment:** GitHub Pages — push to `main` deploys automatically. The hub (`physiodevapp.github.io/physiq/`) is the primary entry point; this app is also accessible standalone.

## Development

No build step, no package manager, no dependencies. All logic is embedded in a single `index.html`.

Run locally:
```
npx serve .
```

No unit tests yet.

## Commit format

Always use this format when committing:

```
git commit -m "short imperative title" -m "description when needed"
```

- First `-m` is the title (max ~72 characters)
- Second `-m` is only included when there is relevant context to add
- Never use `git commit` without flags or interactive editors
- **Never add co-authorship** (`Co-authored-by`) under any circumstance

## Pull request format

- PR body: plain description only — no `🤖 Generated with Claude Code` line, no session URLs, no co-authorship footers

## File Architecture

| File | Role |
|------|------|
| `index.html` | DOM structure, all embedded CSS, and all JavaScript |
| `manifest.json` | PWA manifest (name: "PhysiQ · Saltos", scope: `/physiq/jump/`) |
| `sw.js` | Service Worker (`physiq-jump-v13`, shell-only cache) |
| `favicon.svg` | App icon |

All IDB helpers (`_openDB`, `readSession`, `writeSession`, `clearSession`) are **inlined** directly in `index.html` — there is no `lib/session.js`. Unlike most other satellites, there is no separate `app.js`.

## Design System

Identical to other PhysiQ satellites, with a jump-specific accent color:

- **Fonts:** Outfit (body), DM Mono (labels/data), DM Serif Display (logo)
- **Background:** `--surface2: #0a0d12` (body), `--surface: #111620` (cards)
- **Accent:** `--accent: #f43f5e` (rose) — "Saltos" logo word, primary action buttons, session button when active
- **Secondary:** `--green: #38d9a9`, `--blue: #4f9cf9`
- **Border:** `--border: #232d45`, `--border2: #2d3a58`
- **Header:** Fixed `52px` (`48px` on ≤480px, `44px` on portrait ≤500px height), `backdrop-filter: blur(16px)`, `rgba(10,13,18,0.92)` bg

## Jump Types

5 types defined in `TYPE_OPTIONS`:

| ID | Label | Leg auto-set |
|----|-------|-------------|
| `'CMJ'` | Contramovimiento | — |
| `'SJ'` | Squat Jump | — |
| `'DJ'` | Drop Jump | — |
| `'Mono-D'` | Monopodal Dcha | `selectedLeg = 'right'` |
| `'Mono-I'` | Monopodal Izq | `selectedLeg = 'left'` |

## Jump Measurement

PhysiQ-Jump is **video-based**, not sensor-based. There is no `DeviceMotionEvent` or accelerometer usage.

**Workflow:**
1. User selects a jump type on the home screen
2. Chooses video source: file upload or live camera recording
3. Video loads into `<video id="main-video">` in the analyzer view
4. User scrubs frame-by-frame (`doStep(dir)` — step size: `1/fps` seconds)
5. Taps "Despegue" (`markTakeoff()`) → captures `video.currentTime` into `marks.takeoff`
6. Taps "Aterrizaje" (`markLanding()`) → captures `video.currentTime` into `marks.landing`
7. Metrics compute live in `syncResultPanel()`; user taps "Guardar" to push to `jumps[]`
8. Repeat for additional jumps; tap "Finalizar" to return to home

**Height formula:**
```js
const t = marks.landing - marks.takeoff;  // flight time (seconds)
const h = (G * t * t) / 8 * 100;         // height (cm), G = 9.81
```
Standard ballistic flight-time formula: `h = g·t²/8`, converted to centimeters.

**Frame marker visual:** The video wrapper gets `.at-takeoff` / `.at-landing` CSS class (border color change) when the scrubber is within `±0.5/fps` seconds of a mark. A `#frame-marker-badge` overlay shows "DESPEGUE" / "ATERRIZAJE".

**Each saved jump object** (pushed to `jumps[]`):
```js
{
  id:         Date.now(),
  type:       selectedType,    // 'CMJ' | 'SJ' | 'DJ' | 'Mono-D' | 'Mono-I'
  leg:        selectedLeg,     // 'both' | 'right' | 'left'
  flightTime: number,          // seconds, 4 decimal places
  height:     number,          // cm
  fps,                         // FPS used for analysis
}
```

## FPS Detection

`probeFPS(video)` uses `HTMLVideoElement.requestVideoFrameCallback` to sample 8 consecutive frame timestamps, computes average inter-frame interval, then snaps to the nearest standard value via `snapFPS()`: `[24, 25, 30, 50, 60, 120, 240]`. Falls back to 60 fps if probing fails or the API is unavailable.

User can override manually via the FPS bottom sheet (`#fps-overlay`): preset buttons 30 / 60 / 120 / 240 plus a custom number input. The active FPS is shown as a chip in the analyzer sub-header.

## View State Machine

```
home ──[selectJumpType(type)]──► source ──[openFilePicker()]──► (file picker) → openAnalyzer()
 ▲                                    └──[openCamera()]──────► camera ──[stopRecording()]──► openAnalyzer()
 │                                                                 └──[cancelCamera()]──► source
 │
 ├──[closeAnalyzer() / goHome()]◄──── analyzer ──[saveJump() × N → btn-finish]──► home
 │
 └──[openResultsView(type)]──► results ──[sendToReport()]──► (PHYSIQ_NAVIGATE to 'report')
                                      └──[goHome()]──────► home
```

**Key functions:**
- `showView(name)` — hides all view elements (`view-home`, `view-source`, `view-camera`, `view-analyzer`, `view-results`), shows the named one, updates sub-header via `_updateSubHeader(name)`
- `navigateTo(name)` — increments `navDepth`, calls `history.pushState({ view: name, depth: navDepth })`, then `showView(name)`
- `goHome()` — sets `_popstateLock = true`, calls `history.go(-navDepth)` to pop all pushed states, then `showView('home')`
- `openAnalyzer(src)` — calls `history.replaceState` (not pushState) so the analyzer replaces the source/camera entry in the history stack

`currentView` (string) tracks the current view. `navDepth` (integer) counts `pushState` calls so `goHome()` can pop them all at once.

## Camera Recording

`openCamera()` calls `getUserMedia({ video: { facingMode: 'environment' } })`. `MediaRecorder` collects `recChunks`. Supported MIME types tried in order: `video/mp4`, `video/webm;codecs=h264`, `video/webm`, `video/ogg`. `stopRecording()` creates an object URL and passes it to `openAnalyzer()`.

## Session Persistence

IDB DB `'physiq'` v3, store `'session'`, key `'active'`.

**Jump data is never written to IDB.** Only `patient` and `date` are persisted. All jump data sharing happens exclusively via BroadcastChannel.

**IDB schema default** (created by `writeSession` on first patient write):
```js
{
  sessionId: number,   // Date.now()
  createdAt: number,
  updatedAt: number,
  patient:   string,
  date:      string,   // 'DD/MM/YYYY'
  jump:      null,     // placeholder — never populated by this app
}
```

**Write triggers:**
- Patient name `input` → debounced 800ms → `_persistPatient()` → `writeSession({ patient, date })` — creates session if absent
- Session clear → `clearSession()`

**Ghost-write protection:**
- `_sessionGen` (integer) — incremented on every clear. Captured as `const gen = _sessionGen` before `writeSession()`; if `_sessionGen !== gen` at `.then()` resolve time, calls `clearSession()` to undo the stale write.
- `_sessionCleared` (boolean) — set `true` on clear; reset to `false` in the patient input handler when the user types, preventing stale debounced writes from firing.

**On startup:**
```js
readSession().then(session => {
  if (session) {
    _patient     = session.patient || '';
    _sessionDate = session.date    || _todayStr();
  }
  _updateSessionBtn();
  _sessionCh.onmessage = _handleBC;  // BC listener set after initial session read
});
```

## BroadcastChannel protocol

Channel: `BroadcastChannel('physiq-session')`

`broadcastJumps()` creates a **new** channel instance per call (immediately closed after `postMessage`) to emit jump updates. The persistent `_sessionCh` instance is used only for receiving.

**Messages emitted:**

| Type | When | Payload |
|------|------|--------|
| `SESSION_JUMP` | After `saveJump()` (add) or `deleteJump()` | `{ jumps: [{id, type, leg, flightTime, height, fps}, ...], summary: { count, avgHeight, maxHeight } }` |
| `SESSION_PATIENT` | After `_persistPatient()` when patient is set | `{ patient: string }` |
| `SESSION_CLEAR` | After full session delete | — |

**Messages received** (in `_handleBC`):

| Type | Action |
|------|--------|
| `SESSION_PATIENT` | Updates `_patient` in memory and `#patientName` input — no IDB write |
| `SESSION_CLEAR` | `_softReset()` + `clearSession()` |

## Hub integration

```js
if (window.self !== window.top) {
  document.body.classList.add('in-hub');
  document.querySelector('.logo-main').addEventListener('click', goHub);
}
```

`document.body.classList.add('in-hub')` enables the `‹` animation on `.logo-main::before`.

**postMessages sent to hub:**

| Type | Direction | Trigger |
|------|-----------|--------|
| `PHYSIQ_GO_HOME` | → hub | User taps the logo (`goHub()`) |
| `PHYSIQ_NAVIGATE, to: 'report'` | → hub | User taps "Enviar a informe" (`sendToReport()`) — also calls `broadcastJumps()` first |

**postMessages received from hub:**

| Type | Action |
|------|--------|
| `PHYSIQ_SAT_VISIBLE` | Calls `renderJumpList()` to refresh the home view |

No `PHYSIQ_WIDGET_HIDE` / `PHYSIQ_WIDGET_SHOW` messages are sent — physiq-jump does not interact with the recorder widget.

## Dialogs

- `showConfirmBanner(title, text, actionLabel, onConfirm)` — two-button confirmation (Cancel / action); used for `promptSoftResetJump()`
- `showNotice(title, text)` — single-button notice ("Entendido"); used for camera unavailable / `getUserMedia` errors
- Never use native `confirm()` or `alert()`

The confirm action button (`#confirmAction`) is styled `background: var(--accent); color: #0a0d12`.

## Results view

Filtered per-type list showing each jump's number, type, leg, flight time (ms), FPS, and height (cm). Summary bar at bottom shows count / avg height / max height. "Enviar a informe" button (`sendToReport()`) broadcasts current jumps and navigates the hub to physiq-report. Individual delete buttons call `deleteJump(idx)` — if the last jump of the active filter is deleted, returns to home.

**Toast notifications:**
- `_showJumpSavedToast(n, h)` — green toast "✓ Salto #N — X.X cm", auto-removes after 2500ms
- `_showCopyFeedback()` — accent toast "✓ Saltos copiados al portapapeles", auto-removes after 3000ms

## Sibling repos

The hub at `physiodevapp.github.io/physiq/` is the primary entry point for the ecosystem.

| Repo | Hub path | Role |
|------|----------|------|
| physiq-balance | /physiq/balance/ | Postural stability / balance tests |
| physiq-assessment | /physiq/assessment/ | 5-phase clinical assessment |
| physiq-motion | /physiq/motion/ | Joint ROM measurement |
| physiq-report | /physiq/report/ | Audio transcription + Claude report generation |
| physiq-force | /physiq/force/ | Web Bluetooth force measurement |
