# NIGERIA BIKE RACING 3D
Created with Ibrahim Muhammad.

Offline-first 3D motorcycle racing game: React + Vite + Three.js. No external assets, fonts or APIs — all
models are procedural and all audio is synthesized, so the build is fully self-contained.

## Run locally
```
npm install
npm run dev        # development
npm run build      # production build + offline cache manifest
npm run preview
```

## Build with GitHub
1. Create a GitHub repo and push this folder to the `main` branch.
2. **Web/PWA:** repo *Settings → Pages → Source: GitHub Actions*. Every push to `main` builds and deploys.
   Open the Pages URL once online; after that the game runs with no internet (installable from Chrome's menu).
3. **Android APK:** *Actions → Build Android APK → Run workflow*. Download `app-debug.apk` from the run's Artifacts
   and install it (allow "install unknown apps"). The APK contains the whole game, so it works offline.

## Controls
Touch: drag on the left pad to steer; RIDE / BRAKE / NITRO on the right.
Keyboard: W/↑ gas, S/↓ brake, A D / ← → steer, Space nitro, C camera, R restart, Esc pause.
