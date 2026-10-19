from io import BytesIO
from collections import Counter
import os
import re

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageFilter, ImageOps
from openai import OpenAI
from pydantic import BaseModel

app = FastAPI(title="DotMatrix API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

class SpriteDraft(BaseModel):
    name: str
    palette: list[str]
    rows: list[str]

class GenerateSpriteRequest(BaseModel):
    prompt: str
    size: int = 32

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/generate")
def generate_sprite(request: GenerateSpriteRequest):
    prompt = request.prompt.strip()
    if not prompt or len(prompt) > 500:
        raise HTTPException(status_code=400, detail="Describe a sprite in 1–500 characters.")
    if request.size not in (8, 16, 32, 64):
        raise HTTPException(status_code=400, detail="Unsupported grid size.")
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="AI generation is off. Set OPENAI_API_KEY in the backend environment, then restart the API.")

    try:
        client = OpenAI(timeout=30.0, max_retries=0)
        response = client.responses.parse(
            model=os.getenv("OPENAI_MODEL", "gpt-6-luna"),
            input=[
                {"role": "system", "content": (
                    "Design clean, recognizable pixel-art sprites for a small grid. "
                    "Return a short name, a palette of 2 to 16 uppercase #RRGGBB colors, "
                    "and rows exactly matching the requested grid size. Each row is a string "
                    "of exactly that many symbols. A dot means transparent; hexadecimal digits "
                    "0 through F index into the palette. Never use an index outside the palette. "
                    "Use a clear silhouette and deliberate clusters; avoid noise, gradients, "
                    "anti-aliasing, and prose."
                )},
                {"role": "user", "content": f"Grid: {request.size} by {request.size}. Sprite: {prompt}"},
            ],
            text_format=SpriteDraft,
        )
        sprite = response.output_parsed
    except Exception as exc:
        raise HTTPException(status_code=502, detail="AI generation failed. Check the backend API key, model access, and network, then try again.") from exc

    if sprite is None or not 2 <= len(sprite.palette) <= 16 or len(sprite.rows) != request.size:
        raise HTTPException(status_code=502, detail="AI returned an incomplete sprite. Try a shorter prompt.")
    palette = [color.upper() for color in sprite.palette]
    if any(not re.fullmatch(r"#[0-9A-F]{6}", color) for color in palette):
        raise HTTPException(status_code=502, detail="AI returned an invalid color palette. Try again.")
    if any(len(row) != request.size for row in sprite.rows):
        raise HTTPException(status_code=502, detail="AI returned an invalid grid size. Try again.")
    if any(symbol.upper() not in "0123456789ABCDEF." for row in sprite.rows for symbol in row):
        raise HTTPException(status_code=502, detail="AI returned an invalid pixel symbol. Try again.")

    used = sorted({int(symbol, 16) for row in sprite.rows for symbol in row.upper() if symbol != "."})
    if not used or any(index >= len(palette) for index in used):
        raise HTTPException(status_code=502, detail="AI returned a pixel outside its palette. Try again.")
    remap = {old: new for new, old in enumerate(used)}
    compact_palette = [palette[index] for index in used]
    pixels = [[-1 if symbol == "." else remap[int(symbol, 16)] for symbol in row.upper()] for row in sprite.rows]
    return {"name": sprite.name[:60] or "AI sprite", "palette": compact_palette, "pixels": pixels}

@app.post("/api/convert")
async def convert(file: UploadFile = File(...), size: int = Form(32), colors: int = Form(24)):
    if size not in (8, 16, 32, 64) or not 2 <= colors <= 64:
        raise HTTPException(status_code=400, detail="Unsupported grid size or palette count")
    try:
        raw = await file.read()
        if len(raw) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image must be 10 MB or smaller")
        image = Image.open(BytesIO(raw))
        if image.width * image.height > 40_000_000:
            raise HTTPException(status_code=413, detail="Image dimensions are too large to process")
        image = ImageOps.contain(image.convert("RGBA"), (size, size), Image.Resampling.LANCZOS)
        alpha = image.getchannel("A")
        sharpened = image.convert("RGB").filter(ImageFilter.UnsharpMask(radius=0.8, percent=110, threshold=3)).convert("RGBA")
        sharpened.putalpha(alpha)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.alpha_composite(sharpened, ((size-image.width)//2, (size-image.height)//2))
        rgb = canvas.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        indices = np.asarray(rgb, dtype=np.uint8)
        palette_data = rgb.getpalette()[:colors * 3]
        used = sorted(Counter(indices.flatten()).keys())
        remap = {old: new for new, old in enumerate(used)}
        palette = ["#%02X%02X%02X" % tuple(palette_data[i*3:i*3+3]) for i in used]
        rgba = np.asarray(canvas)
        pixels = [[-1 if rgba[y, x, 3] < 80 else remap[int(indices[y, x])] for x in range(size)] for y in range(size)]
        return {"width": size, "height": size, "palette": palette, "pixels": pixels}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not process image: {exc}") from exc
