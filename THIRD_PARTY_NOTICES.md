# Third-party notices

## Rain on concrete

- Recording: Joseph SARDIN, BigSoundBank sound #1289, [Rain on concrete](https://bigsoundbank.com/rain-on-concrete-s1289.html).
- License: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), as stated on the source page.
- Local asset: `public/audio/rain-on-concrete-1289.mp3`, the publisher's MP3.
- Playback uses a 4–55 second excerpt with a 1.8-second equal-power crossfade at the loop boundary.

## Firework Party field recordings

All five excerpts use [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) recordings. The bundled MP3s are trimmed and lightly filtered from the publishers' high-quality previews. Original recording transients and stereo tails are retained where present.

- `launch.mp3`: ReadeOnly, [woosh.wav](https://freesound.org/people/ReadeOnly/sounds/186956/), 0.210–1.120 s.
- `burst-a.mp3`: Rudmer_Rotteveel, [Sharp Explosion 5 (of 5)](https://freesound.org/people/Rudmer_Rotteveel/sounds/336010/), 0–1.130 s.
- `burst-b.mp3`: Rudmer_Rotteveel, [Whistle and Explosion Single_Firework](https://freesound.org/people/Rudmer_Rotteveel/sounds/336008/), 1.149–2.239 s.
- `crackle-a.mp3`: LukaCafuka, [Firework Crackle](https://freesound.org/people/LukaCafuka/sounds/750682/), 0.091–1.471 s.
- `crackle-b.mp3`: el_boss, [Fireworks - Pop Pop Crackle](https://freesound.org/people/el_boss/sounds/588198/), 1.227–2.607 s.

## TikTok Sans

- Project: TikTok Sans
- Copyright: TikTok Inc. and the font contributors
- Official source: https://github.com/tiktok/TikTokSans
- Local distribution source: `@fontsource-variable/tiktok-sans` 5.3.0
- License: SIL Open Font License 1.1
- Included license: `public/fonts/OFL-TikTokSans.txt`
- Included webfont: `public/fonts/TikTokSans-Variable-Latin.woff2`

TikTok Sans is used as an open-source typeface. TikTok is a trademark of TikTok Ltd.; this repository is an unofficial concept prototype and is not endorsed by TikTok.

## MediaPipe Tasks Vision and Face Landmarker

- SDK: `@mediapipe/tasks-vision` 1.2.3
- Project: Google MediaPipe
- License: Apache License 2.0
- Model: [Google Face Landmarker float16/1](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task), downloaded directly by the browser. The previously used local file matched the official download byte-for-byte.
- Model SHA-256: `64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF`
- The project does not distribute the model binary. The SDK license is documented separately from the model bundle, whose complete redistribution terms have not been independently verified.
- Runtime/model provenance: `public/mediapipe/README.md`


## JavaScript runtime libraries

| Component | License | Source and license text |
| --- | --- | --- |
| p5.js 1.11.13 | LGPL 2.1 | [Corresponding source release](https://github.com/processing/p5.js/tree/v1.11.13) and [license text](public/licenses/p5-LGPL-2.1.txt) |
| React 19.3.1 | MIT | [Upstream source](https://github.com/facebook/react) and [React license](public/licenses/react-MIT.txt) |
| React DOM 19.3.1 | MIT | [Upstream source](https://github.com/facebook/react/tree/main/packages/react-dom) and [React DOM license](public/licenses/react-dom-MIT.txt) |
| Three.js 0.187.0 | MIT | [Upstream source](https://github.com/mrdoob/three.js) and [license text](public/licenses/three-MIT.txt) |
| MediaPipe Tasks Vision 1.2.3 | Apache 2.0 | [Upstream source](https://github.com/google-ai-edge/mediapipe) and [license text](public/licenses/mediapipe-Apache-2.0.txt) |

The application imports p5.js as a separate npm dependency. The upstream p5.js library source is available from the exact release linked above. The project does not patch the p5.js package. It can be rebuilt with a compatible replacement of that dependency.

The four MediaPipe JavaScript/WASM files in `public/mediapipe/wasm/` are byte-for-byte copies from the pinned npm SDK. The separately downloaded `face_landmarker.task` has its own provenance record in [MediaPipe runtime assets](public/mediapipe/README.md). The SDK license and the model-bundle redistribution review are tracked separately.

Build and test dependencies are recorded with their versions in `package-lock.json`. Their upstream licenses remain with the installed packages. These third-party notices do not grant a license to the FACE THE MOMENT application source.
