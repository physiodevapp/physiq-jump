# PhysiQ — Jump Height Analyzer

A clinical tool for physiotherapists that measures vertical jump height from video. The user marks the takeoff and landing frames; jump height is derived from flight time using the standard ballistic formula.

**Primary entry point: [PhysiQ Hub](https://physiodevapp.github.io/physiq/)** — installs as a single PWA covering all PhysiQ apps.

**Standalone: [→ Open app](https://physiodevapp.github.io/physiq-jump/)**

## Usage

1. Select a jump type (CMJ, SJ, DJ, or monopodal).
2. Load a video — upload a file or record directly from the phone camera.
3. Scrub frame-by-frame to find the takeoff and landing moments.
4. Tap **Despegue** and **Aterrizaje** to mark the frames, then **Guardar**.
5. Repeat for additional jumps in the same session.
6. Review per-type results (count, average height, maximum height).
7. Tap **Enviar a informe** to send the data to PhysiQ Report.

## Jump types

| Type | Description |
|------|-------------|
| CMJ | Countermovement jump |
| SJ | Squat jump |
| DJ | Drop jump |
| Mono-D | Monopodal right leg |
| Mono-I | Monopodal left leg |

## Height formula

```
h = g · t² / 8   (meters → × 100 for cm)
```

Where `t` is flight time (landing frame − takeoff frame in seconds) and `g = 9.81 m/s²`. This derives from the symmetric projectile model: time in air = 2 × time to peak.

## FPS

The app auto-detects video FPS via `requestVideoFrameCallback`. If detection fails it defaults to 60 fps. Override manually via the FPS sheet (30 / 60 / 120 / 240 or custom). Higher FPS gives finer frame-step resolution and more precise height measurements.

## Ecosystem integration

Jump results are broadcast in real time via `BroadcastChannel('physiq-session')` (`SESSION_JUMP`). PhysiQ Report displays a purple badge when jump data is available and includes a jump summary in the clinical context sent to Claude.

## Tech stack

- Plain HTML/CSS/JS — no framework, no bundler; all logic in a single `index.html`
- `MediaRecorder` API for in-app camera recording
- Service Worker (`sw.js`) — installable as a PWA, works offline for cached app shell
