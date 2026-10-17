# Bouncy Clock

A minimal iPhone/iPad/desktop clock inspired by thin white-on-black desk-clock apps, with DVD-style bouncing to distribute OLED pixel wear. No analytics, no accounts, no ads, no dependencies.

## Install on iPhone

1. Host the folder as a static HTTPS website (GitHub Pages works).
2. Open the HTTPS site in **Safari** on the iPhone.
3. Tap **Share → Add to Home Screen**, enable **Open as Web App** if offered, then tap **Add**.
4. Launch **Bouncy Clock** from the Home Screen. After one online visit, it should work offline.

## GitHub Pages deployment (no build step)

1. Create a **public repository** called `iosclock` on GitHub.
2. Upload the contents of this folder to the **root of the repository** (not the outer `bouncy-clock` folder).
3. In the repo, open **Settings → Pages → Build and deployment**. Choose **Deploy from a branch**, **main**, **/(root)**, then **Save**.
4. When Pages finishes publishing, the default URL is `https://<username>.github.io/iosclock/` (unless you've configured a custom domain).
5. Open the deployed link in Safari and add it to the Home Screen.

**GitHub Education is not required.** GitHub Pages is available for public repositories on free accounts. If you prefer a private repo, available Pages features depend on your GitHub plan.

## Controls

- **Swipe up/down** anywhere on the clock to make digits brighter/dimmer.
- **Tap the black screen** to reveal the gear; tap it for settings. It fades away to avoid becoming a static bright icon.
- **Landscape and portrait** are both supported, with automatic fitting.
- **24-hour time, leading zero, and seconds** are optional.
- **Bounce speed, clock size, clock colour, and colour change on edge impact** are adjustable.
- **Prevent locking** uses the browser's Screen Wake Lock API if supported and permitted. iOS can still suspend the page or lock the screen; this is not a system-level override.
- Settings are stored only on the device in local storage.

## OLED note

Moving the clock and reducing pixel brightness may **reduce the risk** of uneven OLED ageing, but no software can guarantee prevention of burn-in. The app dims its own digits; for lowest output, also lower iPhone screen brightness from Control Center. iOS may show a Home Indicator/status UI; a web app cannot reliably hide all system chrome.

## Run locally

From this directory run `python -m http.server 8000` and open `http://localhost:8000` in a browser. On iPhone, install via an HTTPS host like GitHub Pages instead.

No libraries, bundlers or services required. `sw.js` handles offline caching; when changing assets, increment `CACHE_NAME` in `sw.js` to make updates propagate.