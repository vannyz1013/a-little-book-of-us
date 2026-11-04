# Final Release Preparation — A Little Book for You

**Run date:** 2026-11-05
**Status:** **PASS for the requested preparation work; physical-phone check remains NOT TESTED.**
**Current preview:** `http://127.0.0.1:4173/` (HTTP 200, bound to localhost only).

## 1. Mobile touch targets

Added a coarse-pointer-only CSS rule in `src/styles/world.css`. It sets a 48 CSS px minimum height for the scene navigation, back links, scene buttons, music buttons, and letter close button. The rule does not match a standard desktop fine pointer, and the desktop navigation remained 44 px in the desktop browser check.

Measurements were taken after the letter's entrance animation settled, using Playwright mobile touch emulation. Before values are from the previous release audit.

| Control / viewport | Before | After | Result |
|---|---:|---:|---|
| Portrait letter controls, 390×844 | 43.1 px | 48 px | **PASS** |
| Portrait letter controls, 375×667 | 43.7 px | 48 px | **PASS** |
| Portrait letter controls, 360×640 | 43.9 px | 48 px | **PASS** |
| Letter controls, 844×390 | At least 44 px | 48 px | **PASS** |
| Letter controls, 667×375 | At least 44 px | 48 px | **PASS** |
| Navigation links / back-to-memories | 44 px | 48 px | **PASS** |
| Desktop navigation at 1440×900, fine pointer | 44 px | 44 px | **PASS, unchanged** |

Pause, Mute, Replay and Back to the cake remain separated, fit without overlap and are reachable by scrolling the letter panel on short portrait screens. The updated controls are shown in [360×640](letter-controls-scrolled-360x640.png), [375×667](letter-controls-scrolled-375x667.png) and [667×375 landscape](letter-controls-scrolled-667x375.png). Keyboard activation passed; browser focus-visible styling remained a 2 px solid outline.

## 2. Build and automated verification

| Check | Status | Actual result |
|---|---|---|
| `npm run typecheck` | **PASS** | Exit code 0. |
| `npm run build` | **PASS** | Exit code 0; Vite 6.4.5 built 68 modules. Existing character chunk warning remains: 628.45 kB minified / 162.73 kB gzip. |
| Unit tests | **NOT TESTED** | `package.json` has no test script and no unit-test/spec suite was found. No dependencies were added. |
| Playwright navigation/audio regression | **PASS** | Home → Memories → Birthday, photo lightbox, Birthday Letter, close/return, music state and responsive letter controls completed. Three MP3 requests were cancelled by browser-context handoffs; successful HTTP 206 playback followed, with no bad HTTP response or media error. |
| Birthday sequence regression | **PASS** | Full sequence **31.02 s**; Replay, Skip, Back to the cake, keyboard activation, emulated mobile touch and reduced motion passed. Zero console/page errors, bad responses, failed requests or WebGL context losses. |
| 48 px target regression | **PASS** | All checked visible controls measured 48×48 px or larger at five requested mobile viewport sizes; no pairwise visual overlap was observed in the scrolled letter screenshots. |
| Keyboard focus check | **PASS** | Tab focus was visible on a navigation link; computed focus ring was solid, 2 px, and `:focus-visible` matched. |

The route/audio harness also verified the exact letter wording, the three loaded original photographs, audio continuity across navigation and letter open/close, pause/resume, mute/unmute, replay and track looping. The single media object remained in use. The sequence regression captured approach, noticing, presentation, wish and final stages.

## 3. Phone testing preparation and LAN access

The Vite preview currently listens on **127.0.0.1:4173**, so it is accessible from this computer only. The active Wi-Fi network's name and IPv4 address are omitted from this report. Windows currently labels that Wi-Fi network **Public**. To avoid opening a listener on a Public network, no LAN-bound server or firewall rule was started.

For a phone on the same trusted home Wi-Fi, after confirming Windows identifies it as a **Private** network, run this from the project directory in PowerShell:

```powershell
$wifiIp = '<current Wi-Fi IPv4 address>'
npm run preview -- --host $wifiIp --port 4174 --strictPort
```

Replace the placeholder with the IPv4 address shown by `ipconfig`, then open **http://<current Wi-Fi IPv4 address>:4174/** on the phone. This binds Vite Preview to that Wi-Fi address rather than `0.0.0.0`; Preview serves the built `dist/` site. If Windows Firewall asks, allow Node only on the trusted **Private** network. Stop the temporary LAN preview with Ctrl+C after testing. The existing localhost preview at port 4173 can remain running.

Mobile preparation checks:

- **PASS** — viewport meta includes `width=device-width`, `initial-scale=1` and `viewport-fit=cover`.
- **PASS** — touch activation uses pointer/touch-compatible controls and passed Playwright touch emulation.
- **PASS** — music begins after an explicit user action; actual audio playback and state continuity were verified in browser.
- **PASS** — the 3D app checks for WebGL 2 and falls back to the flat book if unavailable.
- **PASS** — reduced-motion preference is read by the animation system and the sequence regression completed immediately in that mode.
- **NOT TESTED** — physical phone, phone browser/WebGL implementation, real-device audio policy, mobile GPU frame time and LAN reachability. No phone or Android Debug Bridge was available, and the current Wi-Fi profile is Public.

The requested phone URL is prepared but is **not live yet**. Physical-device results must be recorded after the user opens the temporary LAN preview from a trusted Private network.

## 4. Repository safety and outstanding changes

No changes were staged, committed, pushed or deployed. `git diff --cached --name-only` was empty. Existing uncommitted work was preserved.

At the start of this pass, Git reported these tracked changes:

- Modified: `index.html`, `package.json`, `package-lock.json`.
- Modified components: `BirthdayLetter.ts`, `BookCover.ts`, `Lightbox.ts`, `MemoriesPage.ts`, `MemoryCard.ts`, `MusicPlayer.ts`.
- Deleted components: `LittleThingsPage.ts`, `PaperNote.ts`.
- Modified data/app: `birthdayContent.ts`, `main.ts`, `router.ts`.
- Modified styles: `global.css`, `letter.css`, `nav.css`, `scrapbook.css`.
- Deleted styles: `notes.css`.
- Deleted placeholder images: `placeholder-beige.webp`, `placeholder-rose.webp`, `placeholder-sage.webp`.

Untracked at the start: `docs/`, the three originals under `public/images/memories/` (`IMG_0214.jpeg`, `478.jpeg`, `476.jpeg`), `qa-artifacts/`, `src/components/LetterSheet.ts`, `src/flatBook.ts`, `src/styles/world.css`, and `src/world/`. This pass appended only the coarse-pointer sizing rule to `src/styles/world.css` and added the new report, copied regression harnesses, logs, JSON results and screenshots under this report's QA directory. The working tree remains uncommitted.

## 5. Release readiness

**PASS — ready for the manual phone check, then manual final approval.** Automated route, audio, touch-emulation, keyboard, reduced-motion, typecheck and build checks passed. Physical mobile/LAN testing remains **NOT TESTED** until the temporary preview is opened on a real phone over a trusted Private Wi-Fi network. No deployment was performed.
