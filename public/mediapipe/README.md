# Pinned MediaPipe runtime assets

The application serves the JavaScript and WASM files from the `wasm/` directory of `@mediapipe/tasks-vision` 1.2.3. The SDK declares Apache 2.0. See the [MediaPipe license](../licenses/mediapipe-Apache-2.0.txt).

The browser downloads the model directly from [Google's Face Landmarker float16/1 URL](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task). Its verified SHA-256 is `64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF`. Production builds omit the model binary. The SHA-256 records the verified download and is not a runtime integrity check.

For offline development, serve a private copy of the verified model from a separate local static server with CORS enabled. In `.env.local`, set `VITE_DEV_FACE_MODEL_URL` to that server's model URL. Vite only honors this override in development.

The model download is a static request. Face inference runs in the browser and sends no camera frames to Google or the application host.
