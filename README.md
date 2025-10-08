# Cold Horizon — Complete Web Game (No Unity, GitHub Pages Ready)

A **browser-native 3D first-person** survival mini-game built with **Three.js** (CDN).
Includes:
- Start Menu (New Game / Continue / How To Play / Settings)
- Full gameplay: WASD + mouselook, jump, sprint, raycast harvesting, inventory & crafting, day/night cycle
- Save/Load via localStorage
- Works on GitHub Pages (static site) or any static host

## Run Locally
```bash
python -m http.server 8000
# visit http://localhost:8000
```

## Deploy to GitHub Pages
- Easiest: Settings → Pages → **Deploy from a branch** → Branch `main` → Folder `/ (root)`
- Or keep the included GitHub Action workflow for Pages (`.github/workflows/deploy.yml`).

Controls: Click **Play** → Mouse look + **WASD**; **Space** jump, **Shift** sprint, **E** interact, **Tab** inventory/crafting, **Esc** unlock mouse.
