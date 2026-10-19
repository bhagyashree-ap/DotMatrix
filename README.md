# DotMatrix Studio

A small pixel-art editor. Draw sprites locally, convert images into editable grids, save artwork in your browser, and export transparent PNGs. AI sprite generation is optional and requires an OpenAI API key and API billing.

## Run the app

Requirements: Node.js 18+ and Python 3.9+ (Python is needed for the optional image and AI APIs).

In the project folder, run:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Optional image conversion API

The editor works without the backend. To enable image conversion and AI sprite generation, open a second terminal in this project folder and run:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export OPENAI_API_KEY="your_api_key_here"
uvicorn backend.main:app --reload --port 8000
```

The AI button creates a sprite from a text description on the current grid size. The backend asks OpenAI for a structured palette and pixel grid, validates both, then returns editable pixels to the browser. The key stays on the backend. You can set `OPENAI_MODEL` to another model available to your API account; it defaults to `gpt-6-luna`.

On Windows PowerShell, activate the environment with `.venv\\Scripts\\Activate.ps1`. Vite automatically forwards `/api` calls to the local API. Without the API, image import uses the browser's built-in palette conversion.

## Features

- 8, 16, 32, and 64 pixel square grids
- Pencil, eraser, and flood-fill tools; B, E, and G shortcuts
- Editable starter palette and transparent background
- Undo and redo for drawing and grid changes; Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z
- 24 starter colors plus an in-editor hue wheel, saturation/value shade square, and hex entry for any of 16,777,216 standard sRGB shades; up to 256 swatches at a time
- Optional AI prompt-to-pixel-sprite generation with a validated, editable grid
- Pixel, crochet-stitch, and round-bead rendering, including styled PNG export
- Save artwork to a browsable collection in browser local storage; reopen or delete saved pieces
- Export a full-resolution transparent PNG

Artwork collection is saved in the current browser on the current device. This simple version does not include user accounts, cloud sync, model training, or cloud deployment. Its image-to-pixel import remains a classical image-processing pipeline.

## Sprite check

Use **Check sprite** in the canvas panel to review possible isolated pixels and enclosed one-pixel color specks. Suggestions show the affected pixel and exact color change. Nothing is changed unless you accept a suggestion. Accepted repairs are recorded with their reason and before/after colors, then can be undone or redone. These checks are heuristics; isolated pixels can be intentional details.
