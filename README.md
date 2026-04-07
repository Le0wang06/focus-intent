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

## GitHub

This project is already initialized as a Git repo under `Projects/focus-intent` with a small commit history (scaffold → service worker → popup → options → blocked page → tweaks).

Target remote for this project: **[github.com/Le0wang06/focus-intent](https://github.com/Le0wang06/focus-intent)** (create the empty repo under [Le0wang06](https://github.com/Le0wang06) if it does not exist yet).

```bash
cd ~/Projects/focus-intent
git remote add origin https://github.com/Le0wang06/focus-intent.git   # skip if origin already exists
git branch -M main
git push -u origin main
```

If `origin` is already set to another URL: `git remote set-url origin https://github.com/Le0wang06/focus-intent.git`

If you use the [GitHub CLI](https://cli.github.com/): `gh auth login` then `gh repo create focus-intent --public --source=. --remote=origin --push`.

## Permissions

See the manifest: `storage`, `tabs`, `alarms`, and `http(s)://*/*` host access. Details are in the extension’s options copy and in interview notes you can derive from `service_worker.js`.

## License

MIT
