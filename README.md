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
| `service_worker.js` | Session lifecycle, redirects, friction state, alarms |
| `popup.*` | Start/end session, timer, pause interventions |
| `options.*` | Blocklist, presets, defaults, privacy copy |
| `blocked.*` | Intervention / recovery UI |
| `shared/` | Domain helpers and copy constants |
| `styles/tokens.css` | Shared visual tokens and base controls |
| `icons/` | Toolbar / store icons |

## Permissions

See the manifest: `storage`, `tabs`, `alarms`, and `http(s)://*/*` host access. Details are in the extension’s options copy and in interview notes you can derive from `service_worker.js`.

## License

MIT
