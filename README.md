# DotMatrix Studio

DotMatrix is a pixel-art studio for drawing sprites, turning images into editable pixel grids, and exporting transparent PNGs. Artwork collections stay in the browser on the user’s device.

## Features

- Edit art as pixels, crochet stitches, or round beads.
- Import images as editable grids, with browser-based conversion if the API is unavailable.
- Choose from 24 starter colors or make custom shades with the color wheel and HEX input.
- Review suggested one-pixel repairs; accept, undo, or redo each change.
- Generate editable sprites from text with OpenAI.

## Tech stack

- **Frontend:** React, TypeScript, Vite, HTML Canvas
- **Backend:** FastAPI, Pillow, NumPy
- **AI:** OpenAI API with `gpt-6-luna`; requires an API key and billing.
- **Storage:** Browser `localStorage`; no account or cloud sync.

## Run locally

Requirements: Node.js 18+ and Python 3.9+.

```sh
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

## Start the API

In a second terminal:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export OPENAI_API_KEY="your_api_key_here"
uvicorn backend.main:app --reload --port 8000
```

Vite forwards `/api` requests to the backend. AI generation uses `gpt-6-luna`; set `OPENAI_MODEL` to use another model available to your API account. Keep the API key on the backend and out of source control. Image import uses browser conversion if the API is unavailable.

## System design

```mermaid
flowchart LR
  U[User] --> UI[React + TypeScript editor]
  UI --> C[Canvas renderer and pixel tools]
  UI --> L[(Browser localStorage)]
  UI -->|/api requests| API[FastAPI]
  API --> IMG[Pillow + NumPy image conversion]
  API --> AI[OpenAI Responses API]
  UI --> PNG[Transparent PNG export]
```

The browser handles drawing, rendering, collections, and PNG export. The API converts images and generates structured sprite palettes and pixel grids. Generated art remains editable in the browser.
