# Architecture and Technical Risk Analysis

## Stage-one decision

The first delivery is an intentionally camera-off application shell, typed runtime contracts, test infrastructure, and a single-loop foundation. It proves that the toolchain runs while avoiding a fake demo before real inference and graphics exist.

## Target runtime

```text
React UI (durable state only)
  ├─ permission / error / quality controls
  └─ mounts and disposes RuntimeController

RuntimeController (imperative ownership)
  ├─ CameraSource → HTMLVideoElement / VideoFrame
  ├─ FacePipeline → MediaPipe Face Landmarker
  ├─ ExpressionClassifier → hysteresis + smoothing
  ├─ HeadCollider → landmark-derived ellipsoid/capsule
  ├─ EffectDirector → triggers + intensity envelopes
  ├─ ParticleWorld → pooled typed arrays + collision impulses
  └─ ThreeRenderer → instancing, GLSL, compositing

Worker boundary
  └─ optional classification / particle CPU work using transferable buffers
```

React receives low-frequency state such as permission status, quality tier, face-present state, and user-visible errors. Camera frames, landmark arrays, expression samples, collision data, particle buffers, and frame timing stay in runtime-owned mutable memory.

## Frame and inference flow

1. A user gesture requests `getUserMedia({ video, audio: false })`.
2. The camera video is displayed locally and sampled without copying into React state.
3. Face Landmarker runs at a measured, throttled cadence independent of display refresh.
4. Blendshape scores and landmarks feed a smoothed expression classifier.
5. The classifier uses separate enter/exit thresholds and cooldowns to avoid flicker.
6. Landmarks update a lightweight head ellipsoid or short capsule collider.
7. A single `requestAnimationFrame` loop advances effect envelopes, particles, collisions, and rendering.
8. Visibility loss pauses expensive work; teardown closes every owned resource.

## Expression policy

- Smile: primarily mouth-corner and cheek blendshapes, normalized and smoothed over time.
- Laugh: smile evidence plus jaw-open / mouth-open evidence, with a higher trigger threshold.
- Intensity: continuous measured score after smoothing, never a random proxy.
- Calibration: thresholds are configuration, validated against consented test sessions and documented device conditions.
- No face: decay effects safely and hide face-specific overlays rather than guessing.

## Collision approach

A large physics engine is unnecessary for the required interaction. Start with a landmark-derived ellipsoid in camera/world space. For each active particle:

1. Transform its position into ellipsoid-local coordinates.
2. Detect penetration using the normalized ellipsoid equation.
3. Estimate the surface normal from the ellipsoid gradient.
4. Resolve penetration and reflect velocity with restitution plus tangential damping.
5. Emit one collision event per particle contact edge, not every penetrating frame.
6. Collision event mutates palette/form metadata and schedules a pooled secondary bloom.

This produces inspectable, deterministic results and supports a moving head without a heavyweight solver.

## Rendering plan

- Camera: mirrored CSS/video layer by user choice; inference coordinate mapping is explicit.
- 3D: transparent WebGL canvas above the video, with premultiplied-alpha compositing.
- Rain: instanced rounded ribbons/droplets with shader-driven hue travel and fall phase.
- Fireworks: pooled instanced billboards or low-poly gem particles with ballistic motion.
- Secondary bloom: short-lived pooled burst with collision-derived origin and changed palette/shape.
- Post look: prefer a small custom glow pass or emissive falloff in shaders; do not assume full-screen bloom is affordable on all phones.
- Quality: cap device pixel ratio and adapt particle counts/inference cadence using measured frame time.

## Module boundaries

```text
src/
  app/          React composition and durable UI state
  core/runtime/ single animation loop and runtime lifecycle
  face/         camera, MediaPipe adapter, classifier, head pose/collider inputs
  effects/      triggers, envelopes, particle pools, collision solver
  graphics/     Three.js scene, shaders, resource registry, quality tiers
  workers/      typed worker protocol and worker implementations
  ui/           accessible presentation components
  styles/       design tokens and responsive layout
tests/e2e/      permission/error/device workflows
```

## Principal risks and mitigations

| Risk | Why it matters | Mitigation / proof required |
| --- | --- | --- |
| Camera permission and secure context | Camera works only on secure contexts/localhost and may be denied | User-initiated request, explicit denial UI, HTTPS deployment, Playwright permission tests |
| MediaPipe model payload/startup | WASM/model loading can delay first interaction | Lazy-load after consent, visible loading state, local/CDN strategy documented, cache headers verified |
| Mobile thermal/GPU pressure | Face inference plus particles can throttle quickly | DPR cap, quality tiers, pooled particles, inference throttling, visibility pause, named-device profiling |
| Expression ambiguity | Smiles and laughs differ across users and poses | Blendshape combinations, temporal hysteresis, calibration dataset, never claim perfect detection |
| Coordinate mismatch | Mirroring and aspect-fill crops can misalign effects/collider | One tested transform pipeline from landmark space to render space, visual developer overlay |
| Moving-collider tunneling | Fast particles can pass through a head between frames | Swept segment/ellipsoid test or bounded substeps for high-speed fireworks |
| Worker overhead | Copying large arrays can cost more than it saves | Transferable buffers/double buffering; benchmark before enabling worker paths |
| WebGL context loss | Mobile browsers can evict the context | Context loss/restoration handlers and central resource registry |
| Cleanup leaks | Camera/GPU resources can remain active after navigation | Idempotent `dispose()`, track stop, worker/task close, RAF cancel, teardown tests |
| Browser variance | MediaPipe/WebGL/camera behavior differs by browser | Capability detection, graceful fallback messaging, real mobile and desktop matrix |
| Privacy trust | Camera products are sensitive | Local-only processing, no audio, no uploads, concise privacy copy and network inspection |

## Verification gates for the next stage

- Real camera preview works only after a user gesture and stops on dispose.
- A face-debug overlay proves coordinate alignment without shipping reference media.
- Recorded, consented local test fixtures may be used only in ignored test-data paths.
- Expression scores visibly respond to real MediaPipe results; production code has no random fallback.
- Collision solver has deterministic unit tests for reflection, color/form mutation, and one-shot secondary bloom.
- Build, unit tests, desktop Playwright, and mobile viewport Playwright all pass.
- Performance statements include browser, device, resolution, particle count, inference cadence, and measurement method.
