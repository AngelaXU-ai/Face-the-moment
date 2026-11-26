# FACE THE MOMENT — Global Development Rules

## Product mandate

Build a production-capable, browser-based TikTok LIVE expression-driven AR experience. The final deliverables are a usable public website and public source code.

## Required behavior

- Request and use a real browser camera stream.
- Trigger real-time 3D rainbow rain from a detected smile.
- Trigger large 3D colorful fireworks from a detected laugh.
- Make firework particles physically rebound from a dynamic head collider.
- On collision, change particle color and form and trigger a secondary bloom.
- Map measured expression intensity to effect intensity.
- Support current mobile and desktop browsers.
- Follow the visual language of TikTok's international LIVE product without copying proprietary assets.

## Required stack

- React, TypeScript, and Vite for the application shell.
- p5.js in P2D mode for Rain Party and Firework Party. Share one effects canvas per stage. Three.js may remain in archived gallery code and existing math helpers.
- MediaPipe Face Landmarker for on-device face landmarks and blendshapes.
- Web Workers for suitable CPU-heavy work that does not require DOM or WebGL ownership.
- Vitest for unit and integration tests.
- Playwright for browser and device-level tests.

## Non-negotiable engineering rules

- Render effects from real-time code. Never substitute pre-rendered effect video.
- Never use emoji as a stand-in for a 3D gift or effect.
- Never use random values as a stand-in for real face recognition.
- Never fabricate viewers, collision outcomes, benchmark numbers, or device support claims.
- Never upload, persist, log, or transmit camera frames.
- Do not add a backend or a large physics engine unless a demonstrated requirement makes it unavoidable.
- Keep video frames, landmarks, blendshapes, particles, and other high-frequency data outside React state. Use mutable runtime objects, typed arrays, refs, workers, and render-loop ownership.
- Explicitly stop camera tracks, animation frames, workers, MediaPipe tasks, Three.js renderers, geometries, materials, textures, and render targets during teardown.
- Respect `prefers-reduced-motion`, visibility changes, device thermal constraints, and context loss.
- Preserve deterministic test seams. Synthetic expression samples are allowed only in tests and clearly labeled developer tools, never as production detection.

## Privacy and permissions

- Face inference must be local to the user's browser.
- Explain camera use before requesting permission; request only when initiated by the user.
- The app must remain navigable when permission is denied or the camera is unavailable.
- Do not capture audio unless a future, approved requirement needs it.

## Performance architecture

- React owns durable UI state; the real-time runtime owns per-frame state.
- Use a single coordinated animation loop and avoid per-effect `requestAnimationFrame` loops.
- Reuse particle pools and typed arrays; avoid allocations in hot loops.
- Prefer instancing or shader-driven particles and adaptive quality tiers.
- Face inference cadence is independent from display refresh and must be throttled by measured cost.
- Use a lightweight custom collider/impulse solver for head interaction before considering an external physics engine.
- Report only measurements produced by checked-in benchmark procedures on named hardware/browser combinations.

## Design rules

- Use a near-black stage, restrained translucent surfaces, strong white typography, and cyan/pink accents for live/status moments.
- The portrait camera is the primary surface. Controls and telemetry must not obscure the face.
- 3D gifts use rounded silhouettes, soft specular highlights, saturated candy gradients, and layered bloom-like light—never flat emoji imagery.
- Maintain accessible contrast, 44px minimum touch targets, clear permission/error states, and responsive layouts.

## Repository hygiene

- Pin dependency versions and commit the lockfile.
- `references/` contains private research material and is ignored by git. Never move it into a public or deployable path.
- `work/` is temporary local analysis output and is ignored by git.
- Do not import reference media into application code or copy it to `public/`.
- Keep secrets out of source control. Document required environment variables in `.env.example`.
- Every feature must include proportional tests and teardown coverage.

## Definition of done for future feature work

- Behavior is driven by real camera/inference data in production.
- Permission denial, no-face, lost-camera, tab-hidden, resize, and WebGL context-loss paths are handled.
- Resources are released on route change and unmount.
- Unit tests pass, relevant Playwright flows pass, and production build succeeds.
- Performance and compatibility claims cite reproducible measurements rather than estimates.
