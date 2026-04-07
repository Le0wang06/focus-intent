# Focus Intent

A Chrome extension (Manifest V3) for **intentional browsing**: task-aware focus sessions, escalating friction instead of only hard blocks, and a recovery-oriented interruption page. **Local-first**—no account, backend, or analytics.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose this folder (`focus-intent`).

## Project layout

| Path | Role |
|------|------|
| `manifest.json` | MV3 manifest, permissions |
| `background/main.js` | Service worker entry (listeners only) |
| `background/handlers.js` | `chrome.runtime` message dispatch |
| `background/intercept.js` | Tab URL checks and redirect to intervention page |
| `background/session.js` | Session lifecycle (start, teardown, pause, expiry) |
| `background/storage.js` | `chrome.storage.local` read/write |
| `background/friction.js` | Visit count → intervention stage |
| `background/streak.js` | Daily session streak |
| `popup.*` | Start/end session, timer, pause interventions |
| `options.*` | Blocklist, presets, defaults, privacy copy |
| `blocked.*` | Intervention / recovery UI |
| `shared/` | Storage keys, messaging, domains, time, copy constants |
| `styles/tokens.css` | Shared visual tokens and base controls |
| `icons/` | Toolbar / store icons |

## Permissions

See the manifest: `storage`, `tabs`, `alarms`, and `http(s)://*/*` host access. For behavior details, trace from `background/main.js` through `handlers.js` and `intercept.js`.

## License

MIT
