# Phase 03 Face Tracking Architecture

## Runtime flow

1. A user gesture requests the local camera with `audio: false`, front-facing preference, and a 1280×720 desktop or 720×1280 portrait ideal size.
2. The renderer and the inference scheduler are independent. Inference targets 18Hz using a timer rather than the display animation loop.
3. The preferred path transfers one current `ImageBitmap` to a module Worker. A second frame is never created while one is in flight, so stale frames are dropped instead of queued.
4. The Worker loads the pinned MediaPipe 1.2.3 WASM and pinned Face Landmarker model, tries a GPU delegate with `OffscreenCanvas`, then falls back to CPU.
5. If Worker imaging or MediaPipe-in-Worker is unsupported, a controlled main-thread path tries GPU and then CPU at the same bounded frequency.
6. Only compact scores, geometry, matrix, and timing return to the UI. Camera frames never leave the browser.
7. The expression state machine updates per inference. React receives samples at 8Hz, except that a confirmed trigger is delivered immediately.

## Expression logic

- `smileScore = (mouthSmileLeft + mouthSmileRight) / 2`.
- Smile requires smile evidence with a relatively closed jaw.
- Laugh requires stronger smile evidence plus jaw opening; pucker suppresses common speech/pucker false positives.
- State priority is `LAUGH > SMILE > NEUTRAL`, with `NO_FACE` after a buffered face loss.
- EMA, separate enter/exit thresholds, continuous confirmation, release buffering, and per-expression cooldowns are configurable in `expressionClassifier.ts`.

## Geometry

Landmark bounds provide normalized face center and size. Eye-corner landmarks provide roll. The main thread maps these coordinates through the exact `object-fit: cover` scale and crop, then applies display mirroring. Velocity is calculated in displayed normalized coordinates and smoothed before publication. The MediaPipe 4×4 facial transformation matrix is preserved in each tracking sample for future 3D alignment.
