# Real Camera Test Procedure

Automated tests use Chromium's synthetic media device only to verify permission plumbing and model/WASM loading. They do not validate expression accuracy. Complete this procedure with a real person and camera before calibrating thresholds or claiming device performance.

## Setup

1. Run `npm ci` and `npm run dev`.
2. Open the printed `localhost` URL in the target browser. A deployed build must use HTTPS.
3. Open DevTools Network and filter for `face_landmarker`, `vision_wasm`, and media requests.
4. Confirm the page initially shows **Camera off** and the browser camera indicator is inactive.
5. Click **Start Camera** and allow camera access.
6. Confirm the preview is live, muted, inline, and mirrored by default.
7. Confirm the model and WASM load from the same site, and that no camera frame, blob, base64 image, or video request is uploaded.

## Functional checks

Use the Debug panel to observe actual scores. Record the browser, OS, device, camera resolution, lighting, distance, delegate, inference thread, inference rate, and inference latency. Do not copy one device's thresholds into production without broader testing.

1. **No face:** move fully out of frame. State should become `NO_FACE` after the release buffer, without effect triggers.
2. **Neutral:** look at the camera with a relaxed closed mouth. State should remain `NEUTRAL`.
3. **Smile:** smile lightly with your jaw relaxed and hold briefly. State should enter `SMILE` and Rain Aura should trigger once when Auto Trigger is enabled.
4. **Laugh:** use a bright smile with your jaw comfortably open and hold briefly. State should prefer `LAUGH` over `SMILE` and Firework Party should start.
5. **Ordinary open mouth:** open the mouth without smiling. It must not enter `LAUGH`.
6. **Yawn:** yawn without lifted mouth corners. It must not enter `LAUGH`.
7. **Speech:** read a sentence normally. Brief jaw motion must not repeatedly trigger laughter.
8. **Pucker:** pucker the lips while opening the jaw. The pucker guard should suppress laughter.
9. **Release:** stop smiling. Confirm the state does not flicker and releases after approximately 250ms.
10. **Cooldown:** repeat the same expression rapidly. Confirm triggers are rate-limited even when state transitions are visible.

## Geometry and presentation checks

1. Move left/right and up/down. Confirm the face guide follows the displayed face, not the uncropped source position.
2. Toggle **Mirror**. Confirm horizontal position and roll direction invert while size remains stable.
3. Test 1440×900, 1920×1080, and a real portrait phone. Confirm `object-fit: cover` cropping does not offset the guide.
4. Tilt the head in both directions. Confirm the reported tilt direction matches the visible mirrored preview.
5. Move quickly, then hold still. Confirm position, size, and speed settle without React/UI updates at camera-frame frequency.

## Lifecycle and failure checks

1. Click **Stop**. Confirm the browser camera indicator turns off and the video track ends.
2. Start again and deny permission. Confirm the UI explains how to retry.
3. Test with no camera or with the camera occupied by another app. Confirm the device-unavailable message.
4. Block the official model URL in browser developer tools, then reload and start the camera. Confirm a model-loading error is shown without pretending tracking is active.
5. Background the tab and return. Confirm inference does not build a frame backlog.
6. Navigate away or reload while tracking. Confirm camera tracks, Worker, MediaPipe task, timers, and GPU resources are released.

## Calibration record

The initial configurable values are starting points, not measured claims:

| Parameter | Initial value |
| --- | ---: |
| EMA time constant | 78ms |
| Smile enter / exit | 0.34 / 0.27 |
| Smile jaw maximum / release | 0.28 / 0.35 |
| Laugh smile enter / exit | 0.56 / 0.48 |
| Laugh jaw enter / exit | 0.22 / 0.16 |
| Smile / laugh confirmation | 150ms for both, with at least 3 distinct samples |
| Release buffer | 250ms |
| Minimum laugh hold | 340ms |
| Smile / laugh cooldown | 1200ms / 1800ms |
| Target inference / UI rate | 18Hz / 8Hz |

For each change, record false positives for speech, yawning, and ordinary mouth opening as well as missed smiles/laughs across different faces, skin tones, facial hair, glasses, lighting, cameras, and browsers.
