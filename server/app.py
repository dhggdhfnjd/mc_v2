"""POST /v1/recognize — the same recogniser as the in-browser one, behind an HTTP API.

Same model file and the same label table as the web app, so both paths give the same answer.
Set NEXT_PUBLIC_VISION_BASE=<this service's URL> when building the web app to use it, e.g. when
the Cloud Phone remote browser turns out to restrict WebAssembly.

Run locally:
    uv run --with fastapi --with uvicorn --with python-multipart --with onnxruntime \
           --with pillow --with numpy uvicorn server.app:app --port 8787
"""
import io
import json
import os

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

ROOT = os.path.dirname(os.path.abspath(__file__))
MODELS = os.environ.get("MODELS_DIR", os.path.join(ROOT, "..", "public", "models"))
MAX_BYTES = 5 * 1024 * 1024

session = ort.InferenceSession(os.path.join(MODELS, "mobileclip_s0_vision.onnx"), providers=["CPUExecutionProvider"])
with open(os.path.join(MODELS, "label-embeddings.json"), encoding="utf-8") as fh:
    table = json.load(fh)
LABEL_IDS = [entry["id"] for entry in table["labels"]]
LABELS = np.array([entry["vec"] for entry in table["labels"]], dtype=np.float32)
# text-only vectors for the "is it a crop at all" check; older tables have only vec
GATES = np.array([entry.get("gate", entry["vec"]) for entry in table["labels"]], dtype=np.float32)
GATE = float(table.get("gate", 1))
NEGATIVES = np.array(table["negatives"], dtype=np.float32)
SIZE = int(table["input"])

app = FastAPI(title="Mizani vision", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["POST", "GET"], allow_headers=["*"])


def preprocess(image: Image.Image) -> np.ndarray:
    image = image.convert("RGB")
    width, height = image.size
    side = min(width, height)
    left, top = (width - side) // 2, (height - side) // 2
    image = image.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.BILINEAR)
    return (np.asarray(image, dtype=np.float32) / 255.0).transpose(2, 0, 1)[None]


def rank(embedding: np.ndarray) -> list[dict]:
    """Same two steps as rank() in app/lib/vision.ts: whether it is a crop, then which one."""
    embedding = embedding / (np.linalg.norm(embedding) or 1.0)
    gate = table["scale"] * GATES @ embedding
    other = table["scale"] * NEGATIVES @ embedding
    top = max(gate.max(), other.max())
    if np.exp(other - top).sum() > GATE * np.exp(gate - top).sum():
        return []  # looks more like "a person / a room / a document" than any crop
    crop = table["scale"] * LABELS @ embedding
    mass = np.exp(crop - crop.max())
    share = mass / mass.sum()
    return [{"commodityId": LABEL_IDS[i], "confidence": round(float(share[i]), 4)} for i in np.argsort(-share)[:3]]


@app.get("/healthz")
def healthz():
    return {"ok": True, "model": table["model"], "labels": len(LABEL_IDS)}


@app.post("/v1/recognize")
async def recognize(image: UploadFile = File(...)):
    blob = await image.read(MAX_BYTES + 1)
    if len(blob) > MAX_BYTES:
        raise HTTPException(413, "Image larger than 5 MB")
    try:
        picture = Image.open(io.BytesIO(blob))
        picture.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(400, "Not a readable image") from exc
    embedding = session.run(None, {"pixel_values": preprocess(picture)})[0][0]
    return {"candidates": rank(embedding)}
