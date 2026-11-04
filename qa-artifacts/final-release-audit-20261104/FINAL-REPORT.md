# Final Release Audit — A Little Book for You

**Audit date:** 2026-11-05
**Overall status:** **READY FOR MANUAL FINAL APPROVAL**, with the noncritical limitations listed below.
**Preview:** `http://127.0.0.1:4173/` returned HTTP 200 after the final build.

The approved character designs, cake, desktop composition, letter wording, audio implementation and 31-second choreography were preserved. Two narrow responsive corrections were included after the audit exposed small-screen issues; neither changes character or cake geometry.

## QA results

| Feature | Status | Test and result | Remaining issue |
|---|---|---|---|
| Desktop Birthday Garden | **PASS** | Inspected at 1920×1080, 1440×900 and 1366×768. Cake and both characters remain visible; no horizontal overflow, visible clipping or floating feet. | None found in these captures. |
| Mobile portrait and landscape | **PASS** | Inspected at 390×844, 375×667, 360×640, 844×390 and 667×375. Camera adapts by aspect ratio; all primary scene subjects and controls remain in view. | Actual device rendering was not tested; see performance section. |
| Navigation and layout | **PASS** | Home → Our Memories → Birthday Garden → Birthday Letter → Birthday Garden. Nav stays centered, no horizontal page overflow at the audited sizes; the long letter is vertically scrollable and its controls remain reachable. | On short portrait screens, letter controls require scrolling within the letter panel. |
| Memory photographs | **PASS** | Exactly three originals loaded: `IMG_0214.jpeg` 1536×1152, `478.jpeg` 1279×1706, `476.jpeg` 1706×1279. Photo opening/closing returned to the scene; aspect ratios remained intact. | None found. |
| Birthday letter and envelope | **PASS** | Approved wording matched exactly. Envelope/letter open, close and return-to-Birthday worked. At 375×667 the letter close control now follows the text instead of sticking over it. | None found after correction. |
| Background music | **PASS** | Actual MP3 playback verified after user interaction, across scene changes and the letter. Pause/resume, mute/unmute, replay, looping and preserved paused/muted states passed. One media object/control group remained in use; no duplicate player appeared. | Three superseded MP3 preload requests were cancelled at automated browser-context handoffs (`ERR_ABORTED`); the asset itself loaded with HTTP 206 and played without a media error. |
| Birthday surprise | **PASS** | Full playback completed in **31.02 s**. Approach, notice, presentation, wish and final stages were captured. Replay, Skip, Back to the cake, keyboard, emulated touch and reduced-motion behavior passed. | None found in regression. |
| Console, requests and WebGL | **PASS** | Final visual and sequence runs: zero console/page errors, zero failed requests, zero bad HTTP responses and zero WebGL context losses. | The separate navigation/audio run logged the three expected MP3 request cancellations above. |
| Touch targets | **PASS** | Birthday scene and navigation targets met 44 CSS px in the sampled layouts. | In portrait letter view, Pause, Mute, Replay and Back to the cake measured 43.1–43.9 px high (wide targets). This is a minor shortfall from the 44 px audit threshold. |
| Typecheck and production build | **PASS** | `npm run typecheck` exit 0; `npm run build` exit 0, including TypeScript checking. | Vite still reports the character chunk size warning; details below. |
| Existing unit tests | **NOT TESTED** | `package.json` defines no test script, and no existing unit-test/spec suite was found. | No automated unit-test runner is configured. |
| Physical mobile performance | **NOT TESTED** | No Android Debug Bridge (`adb`) was available to connect a physical device. Mobile browser emulation was run separately. | Emulated measurements are not mobile-device performance results. |

## Screenshots

### Birthday Garden — required viewports

| Viewport | Capture |
|---|---|
| 1920×1080 | [birthday-final-1920x1080.png](birthday-final-1920x1080.png) |
| 1440×900 | [birthday-final-1440x900.png](birthday-final-1440x900.png) |
| 1366×768 | [birthday-final-1366x768.png](birthday-final-1366x768.png) |
| 390×844 | [birthday-final-390x844.png](birthday-final-390x844.png) |
| 375×667 | [birthday-final-375x667.png](birthday-final-375x667.png) |
| 360×640 | [birthday-final-360x640.png](birthday-final-360x640.png) |
| 844×390 | [birthday-final-844x390.png](birthday-final-844x390.png) |
| 667×375 | [birthday-final-667x375.png](birthday-final-667x375.png) |

### Other flow and sequence captures

- [Home](home-1440x900.png), [Our Memories](memories-1440x900.png), [photo open](memory-photo-open.png), [Birthday before letter](birthday-before-letter.png), [letter open](birthday-letter-open.png)
- Surprise stages: [approach](sequence-approach-final.png), [Mun Yi notices Zi Nor](sequence-noticing-final.png), [cake presentation](sequence-presentation-final.png), [both look at the cake](sequence-wish-final.png), [final composition](sequence-final-composition.png)
- Short portrait letter after scroll: [375×667 controls](letter-controls-scrolled-375x667.png), [360×640 controls](letter-controls-scrolled-360x640.png)
- Mobile-emulated performance capture: [390×844](mobile-emulation-gpu-390x844.png)

## Music verification

The real `happy-birthday.mp3` asset loaded with duration **37.224 s**, `readyState=4`, looping enabled, and no media error. It was paused before a valid user action, then played after interaction. The same media object remained active while navigating and opening/closing the letter; the surprise did not create another player or reset playback. Pause/resume, mute/unmute, replay and end-of-track looping were exercised. Paused and muted state remained set when the surprise was activated. The media element is intentionally detached from the DOM while its single control group remains available.

The navigation harness observed three cancelled MP3 preload/range requests when test contexts were handed off. Successful HTTP 206 range responses followed, playback continued, and no failed HTTP response or media event error was recorded. This is a request cancellation during test/navigation handoff, not a missing music asset.

## Birthday sequence and interaction

- Full sequence: **31.02 seconds**.
- Replay: **PASS**.
- Skip: **PASS**.
- Back to the cake: **PASS**, restored the same two character roots at their idle positions.
- Keyboard activation: **PASS**.
- Mobile touch activation: **PASS in Playwright touch emulation**.
- Reduced motion: **PASS**, sequence completed immediately and returned to the scene.
- Console/page errors, failed requests, bad responses and context loss during sequence regression: **0**.

## Performance and bundle review

**Hardware GPU renderer:** Chrome 157 reported `ANGLE (Intel, Intel(R) UHD Graphics (0x00004688) Direct3D11 vs_5_0 ps_5_0, D3D11)` through `WEBGL_debug_renderer_info`. This is Intel UHD hardware through ANGLE/D3D11, not SwiftShader.

| Run | Environment | Average / frame times | Interpretation |
|---|---|---|---|
| Existing desktop hardware baseline | Intel UHD, 1600×900 | 59.01 average FPS; p50 18.1 ms, p95 24.1 ms, p99 30.2 ms, max 36.4 ms; 1% low 31.41 FPS; 2 frames >33.3 ms, none >50 ms | Hardware desktop result from the prior equivalent GPU run; not compared to mobile emulation. |
| Mobile browser emulation | 390×844, emulated touch/coarse pointer, requested DPR 3, on the same Windows desktop/Intel GPU | 98.61 RAF average FPS; mean 10.14 ms, p50 12.0 ms, p95 12.5 ms, p99 18.2 ms, max 48.5 ms; one frame >33.3 ms and none >50 ms | **Simulated mobile workload only.** The FPS is controlled by the desktop browser/display and must not be read as phone performance. |

During the emulated mobile run the renderer reported 238 draw calls, 721,230 triangles, 118 geometries, 10 textures, a 1024 shadow map and an effective app pixel ratio of 1.5. The requested emulation DPR was 3. Chrome CDP reported 2.354 s task duration, 1.994 s script time, zero layout time and negligible style-recalculation time over the sample; heap was 56.7 MB at the start and 55.1 MB at the end. The timer-query extension was available but GPU timer queries were not instrumented, so **GPU frame time was not measured**. Texture/geometry byte residency and isolated shader/animation costs were also not available from this run. No device-specific mobile bottleneck was established, so no performance-quality tradeoff was made.

The production character chunk is **628.45 kB minified / 162.73 kB gzip**, exceeding Vite's 500 kB warning threshold. The app already emits separate chunks for the flat book, Lightbox, character preview and the world/character code. This audit found no clearly unused code or duplicate asset that could be removed safely; no bundle refactor was made.

## Audit corrections

- `src/styles/world.css`: short-screen breakpoint raised to 680 px. Chromium reported a 375×667 mobile viewport with fractional CSS sizing that did not match the previous `max-height: 667px` rule, leaving the sticky letter-close control over the end of the text. At 375×667 it now follows the content and is reachable by scrolling.
- `src/world/layout.ts`: the resting short-portrait camera target was adjusted slightly to give the candle prompt more separation from character feet at 360×640 and 375×667. Character/cake object transforms and the approved desktop composition were left intact.

No unrelated scene or content changes were made during this audit. Existing uncommitted work was preserved.

## Remaining limitations

**Critical release blockers:** none found in the tested environments.

**Noncritical limitations:** no physical mobile device or mobile GPU result; no measured GPU frame time or texture/geometry byte memory; no configured unit-test suite; Vite character-chunk warning; four letter-view portrait controls fall up to 0.9 px short of the 44 px touch-target audit threshold; three MP3 preload requests were cancelled at automated browser-context handoffs despite successful playback.

## Release recommendation

The tested desktop/browser flows, audio, responsive layouts and birthday sequence pass. The project is **ready for manual final approval** with the limitations above. Nothing was staged, committed, pushed or deployed.
