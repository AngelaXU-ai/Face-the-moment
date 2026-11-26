# FACE THE MOMENT

FACE THE MOMENT is a browser-based, facial-expression-driven AR experience inspired by live-streaming interfaces. The LIVE stage layers real-time particle effects over a local camera feed. It is an independent concept prototype.

## Live demo

A public demo link will be added after deployment. Use the local setup below to try the experience today.

## Core experience

- **Rain Aura** responds to a gentle smile with diagonal rain, water ripples, and recorded rain ambience.
- **Firework Party** responds to a broad, naturally open smile with staggered fireworks, cascading trails, and synchronized launch, burst, and falling-spark audio.
- **Head interaction** uses a hidden upper-head collider estimated from face landmarks. Firework particles can bounce off the arc and produce small secondary sparks.
- **Manual preview** lets you try either effect without enabling the camera. The LIVE controls also offer intensity, camera mirroring, fullscreen where the browser supports it, and independent firework sound controls.

## Technology stack

React, TypeScript, and Vite power the interface. MediaPipe Tasks Vision performs local facial tracking, p5.js renders the effects in P2D, and Web Audio plays local recordings. Three.js supplies math utilities for the active effects. Vitest and Playwright cover unit and browser tests.

## System architecture

1. **Camera** — `src/camera/useCamera.ts` owns stream acquisition, playback, cancellation, and track cleanup. Failed playback releases the acquired stream so startup can be retried.
2. **Face tracking** — `src/face/` and `src/workers/` process local frames into pose and blendshape data. The runtime prefers a Web Worker and provides a throttled main-thread fallback. The expression classifier uses temporal smoothing and separate entry and release thresholds.
3. **Effect arbitration** — `src/graphics/EffectManager.ts` handles manual and expression-triggered requests. One effect owns the stage at a time. The outgoing effect fades and clears before the next begins.
4. **Rendering and sound** — `src/graphics/EffectPreview.tsx` owns the shared p5.js canvas. The rain and firework modules update pooled particles using elapsed time. Firework collision uses a swept, screen-space upper-head arc. Each effect controls its own audio fade and playback cleanup.

## Performance

The stage uses a single effect canvas with bounded particle pools, cached firework glows, idle draw-rate reduction, and rendering suspension while the tab is hidden. Inference admits one frame at a time, and live status updates are throttled independently of drawing. Camera frames and particle state stay outside React state.

## Local development

Use Node.js 22 and npm. Install from the committed lockfile and start Vite:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. No API key or environment file is required. On first visit, the short LIVE tutorial introduces the stage and controls. Select **Start Camera** to enable expression triggers or use **Manual Preview** to try the effects.

## Production build and tests

```bash
npm run build
npm run preview
```

Vite writes the static site to `dist/`. Serve it at the root of an HTTPS origin so the application can load its local MediaPipe assets and request camera access.

```bash
npm test
npx playwright install chromium
npm run test:e2e
```

Playwright uses a fake media device for automated camera coverage. For checks with a physical device, see the [real-camera test procedure](docs/real-camera-test.md).

## Camera permissions and privacy

The browser asks for camera permission after you choose **Start Camera**. Camera access requires HTTPS or a trusted local origin such as `localhost`. The app requests video only. Camera frames and expression inference stay in the browser, and camera frames are neither uploaded nor recorded. You can stop the stream from the LIVE interface.

## Repository layout

| Path | Contents |
| --- | --- |
| `src/app/`, `src/ui/`, `src/styles/` | LIVE interface, controls, and tutorial |
| `src/camera/`, `src/face/`, `src/workers/` | Camera lifecycle, expression classification, and inference |
| `src/graphics/` | Effect arbitration, particle rendering, collision, and audio |
| `src/assets/`, `public/` | Effect icons and static runtime assets |
| `tests/`, `docs/` | Browser tests and engineering documentation |

## Third-party credits and licenses

See [Third-party notices](THIRD_PARTY_NOTICES.md) for runtime libraries, recordings, and asset provenance, and [MediaPipe assets](public/mediapipe/README.md) for the model version and checksum. Third-party license terms apply to their respective components.

## Application source copyright

The application source is available for evaluation and review only. See the [copyright notice](COPYRIGHT.md). The browser downloads the face model from Google's pinned official URL, so first-time tracking requires access to that URL.
