# Emerald Encounter Tracker

A compact, browser-based encounter tracker for Pokemon Emerald when played with Archipelago (compatible with the 0.6.x stable client and the 3.0.0-beta apworld). Use it to visualize map-based encounter tables, mark Pokémon as caught, and sync with an Archipelago game session.

Live demo / built artifact
- Direct access: https://rawgit.moyskleytech.com/ObsidianMakerDevelopment/emerald-ap-encounter-tracker/dist/emerald-encounter-tracker.html
 - Download (prebuilt single-file HTML): https://github.com/ObsidianMakerDevelopment/emerald-ap-encounter-tracker/releases

Key features
- Visual map tabs generated from an Archipelago patch (per-map encounter groups).
- Reveal/hide Pokémon sprites and names until marked as caught.
- Track caught state locally and optionally sync with an Archipelago session.
- Tab and group state indicators showing catchability and progress.

Supported patch file types
- Official release patches: `.apemerald`
- Beta/apworld patches: `.apemeraldbeta`

Requirements
- Modern browser with JavaScript enabled.
- To build locally: Node.js and npm (used for bundling with `vite`).

Install & build (local)
1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Build the single-file HTML artifact:

```bash
npm run build
```

4. Open the built file at `dist/emerald-encounter-tracker.html` in your browser (or serve `dist/` from a static webserver).

Quick usage
1. Open the tracker page in your browser (either the built `dist/` file or the hosted demo link above).
2. Click "Load Patch" and select your patch file. The file picker accepts both `.apemerald` and `.apemeraldbeta` files.
3. After the patch is applied the map tabs will be generated. Use "Apply & Connect" to connect to your Archipelago server and enable live sync (optional).
4. Click a Pokémon card to toggle its caught/revealed state. State is persisted locally in `localStorage` and will sync to a connected Archipelago room when available.

Developer notes
- Source: tracker code is in `tracker/` (entry: `tracker/tracker.mjs`).
- The app bundles with `vite` and `vite-plugin-singlefile` to produce a portable single HTML file under `dist/`.
- The file picker now accepts both `.apemerald` and `.apemeraldbeta` patch files.

Contributing
- Issues and pull requests are welcome. Keep changes focused and small.

License
- See the `LICENCE` file in this repository.

Contact
- Open an issue if you find bugs or want features.
