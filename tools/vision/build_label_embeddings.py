"""Rebuild public/models/label-embeddings.json — the text side of the zero-shot recogniser.

The web app ships only MobileCLIP-S0's image encoder. What each catalog crop "looks like" is
written here in plain English, embedded once with the text encoder, and saved as a small JSON.
Adding a crop or fixing a confusion means editing LABELS below and re-running this script; no
training and no labelled photos are needed.

    # one-off downloads (text encoder 170 MB, tokenizer, original image encoder 45 MB)
    mkdir -p .cache && cd .cache && for f in onnx/text_model.onnx onnx/vision_model.onnx tokenizer.json; do \
      curl -L -O https://huggingface.co/Xenova/mobileclip_s0/resolve/main/$f; done && cd ..
    uv run --with tokenizers --with onnxruntime --with numpy --with pillow python build_label_embeddings.py .cache
    # optional accuracy check against your own photos laid out as <dir>/<crop id>/*.jpg ("other" = non-crops)
    uv run ... python build_label_embeddings.py .cache --eval path/to/photos

Measured on 19 Sep 2026 with 91 curated Wikimedia Commons photos of the 18 crops plus 6
non-crop photos: top-1 84.6%, top-3 97.8%; through a simulated 0.08 MP keypad-phone camera
(320x240, JPEG q55) top-1 79.1%, top-3 97.8%; all 6 non-crop photos rejected. The set is small
and guided the wording below, so treat the figures as optimistic until field photos exist.
"""
import io, json, os, sys
import numpy as np
import onnxruntime as ort
from PIL import Image
from tokenizers import Tokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "models", "label-embeddings.json")

LABELS = {
    "maize": ["maize cobs", "dry maize grain", "corn kernels", "white maize cobs drying in the sun", "ears of corn"],
    "beans": ["dry beans", "red kidney beans", "speckled rosecoco beans", "dried pinto beans"],
    "tomato": ["tomatoes", "fresh red tomatoes"],
    "onion": ["onions", "red onions"],
    "matooke": ["unripe green cooking bananas", "a bunch of green plantains", "matooke green bananas"],
    "potato": ["potatoes", "Irish potatoes", "brown potatoes in a sack"],
    "rice": ["uncooked white rice grains", "raw rice"],
    "cabbage": ["cabbage", "round heads of cabbage"],
    "omena": ["tiny dried fish", "dried silver sardines", "dried anchovies", "omena fish"],
    "gnuts": ["groundnuts", "peanuts", "peanuts in their shells", "shelled peanut kernels with red skins"],
    "cassava": ["cassava roots", "long brown cassava tubers"],
    "millet": ["finger millet grain", "tiny reddish-brown millet seeds", "ragi grains"],
    "sorghum": ["sorghum grain", "white and red sorghum grains"],
    "kale": ["collard greens", "kale leaves", "sukuma wiki leafy greens"],
    "melon": ["watermelons", "a watermelon"],
    "banana": ["ripe yellow bananas", "a bunch of yellow dessert bananas"],
    "ndengu": ["green mung beans", "green grams", "small green dry beans"],
    "pepper": ["chili peppers", "hot red chillies", "green chili peppers"],
}
TEMPLATES = [
    "a photo of {}.",
    "a close-up photo of {}.",
    "{} for sale at a market.",
    "a pile of {}.",
    "a blurry low resolution photo of {}.",
]
# Things a trader might photograph by accident. Mass landing here means "not a crop we know".
NEGATIVES = [
    "a photo of a person.", "a photo of a face.", "a photo of a hand.", "a photo of a room.", "a photo of a street.",
    "a photo of a car or motorcycle.", "a photo of an animal.", "a photo of clothes.", "a photo of a document with text.",
    "a photo of a phone or a screen.", "a photo of money.", "a photo of the ground.", "a photo of the sky.",
    "a photo of cooked food on a plate.", "a dark blurry photo of nothing.",
]

def tokenize(tok, texts):
    ids = np.zeros((len(texts), 77), dtype=np.int64)  # pad token "!" is id 0
    for i, t in enumerate(texts):
        enc = tok.encode(t.lower()).ids[:77]
        enc[-1] = 49407 if len(enc) == 77 else enc[-1]
        ids[i, : len(enc)] = enc
    return ids


def norm(x):
    return x / np.linalg.norm(x, axis=-1, keepdims=True)


def preprocess(im, size=256):
    im = im.convert("RGB")
    w, h = im.size
    s = size / min(w, h)
    im = im.resize((max(size, round(w * s)), max(size, round(h * s))), Image.BILINEAR)
    w, h = im.size
    l, t = (w - size) // 2, (h - size) // 2
    im = im.crop((l, t, l + size, t + size))
    return (np.asarray(im, dtype=np.float32) / 255.0).transpose(2, 0, 1)[None]


def keypad_camera(im):
    """Simulate the itel handset: 0.08 MP (320x240) sensor, heavy JPEG."""
    im = im.convert("RGB")
    im.thumbnail((320, 240), Image.BILINEAR)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=55)
    return Image.open(io.BytesIO(buf.getvalue()))



def main():
    cache = sys.argv[1]
    tok = Tokenizer.from_file(os.path.join(cache, "tokenizer.json"))
    text = ort.InferenceSession(os.path.join(cache, "text_model.onnx"), providers=["CPUExecutionProvider"])
    ids = list(LABELS)
    label_vecs = np.stack([
        norm(norm(text.run(None, {"input_ids": tokenize(tok, [t.format(p) for p in LABELS[c] for t in TEMPLATES])})[0]).mean(0))
        for c in ids
    ])
    neg_vecs = norm(text.run(None, {"input_ids": tokenize(tok, NEGATIVES)})[0])
    json.dump({
        "model": "Xenova/mobileclip_s0 (Apple MobileCLIP-S0)", "dim": int(label_vecs.shape[1]), "scale": 100, "input": 256,
        "labels": [{"id": c, "vec": [round(float(x), 4) for x in v]} for c, v in zip(ids, label_vecs)],
        "negatives": [[round(float(x), 4) for x in v] for v in neg_vecs],
    }, open(OUT, "w"), separators=(",", ":"))
    print("wrote", os.path.normpath(OUT))

    if "--eval" in sys.argv:
        root = sys.argv[sys.argv.index("--eval") + 1]
        vision = ort.InferenceSession(os.path.join(cache, "vision_model.onnx"), providers=["CPUExecutionProvider"])
        table = np.concatenate([label_vecs, neg_vecs])
        for camera in ("full", "keypad"):
            n = top1 = top3 = rejected = others = 0
            for cls in sorted(os.listdir(root)):
                folder = os.path.join(root, cls)
                if not os.path.isdir(folder):
                    continue
                for name in sorted(os.listdir(folder)):
                    if not name.lower().endswith((".jpg", ".jpeg", ".png")):
                        continue
                    im = Image.open(os.path.join(folder, name))
                    v = norm(vision.run(None, {"pixel_values": preprocess(keypad_camera(im) if camera == "keypad" else im)})[0])[0]
                    z = 100.0 * table @ v
                    p = np.exp(z - z.max())
                    unknown = p[len(ids):].sum() > p[: len(ids)].sum()
                    if cls == "other":
                        others += 1; rejected += int(unknown)
                        continue
                    order = [ids[i] for i in np.argsort(-p[: len(ids)])[:3]]
                    n += 1; top1 += int(not unknown and order[0] == cls); top3 += int(not unknown and cls in order)
            print(f"{camera:7s} top1 {top1}/{n} = {top1 / max(n, 1):.1%}   top3 {top3}/{n} = {top3 / max(n, 1):.1%}   non-crop rejected {rejected}/{others}")


if __name__ == "__main__":
    main()
