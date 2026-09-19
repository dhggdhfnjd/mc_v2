"""Rebuild public/models/label-embeddings.json — what the zero-shot recogniser compares a photo to.

The web app ships only MobileCLIP-S0's image encoder (23 MB). Each catalog crop is described in
plain English below, embedded once with the text encoder, and saved as a small JSON (~50 KB).
With --photos, a handful of real photos per crop are averaged into that crop's vector as well
(a "prototype"): the table stays the same size and the model does not change, but the crops
that text alone cannot tell apart get much easier. Two vectors are stored per crop:

  vec   text + photos — decides WHICH crop it is
  gate  text only     — decides WHETHER it is a crop at all, against the NEGATIVES below

Photo prototypes pull every crop closer to any photo, so they would swamp the non-crop check;
keeping that check on the text-only vectors, with a GATE factor, keeps people, rooms and
documents out.

    # one-off downloads (text encoder 170 MB, tokenizer, original image encoder 45 MB)
    mkdir -p .cache && cd .cache && for f in onnx/text_model.onnx onnx/vision_model.onnx tokenizer.json; do \
      curl -L -O https://huggingface.co/Xenova/mobileclip_s0/resolve/main/$f; done && cd ..
    # photos laid out as <dir>/<crop id>/*.jpg, plus <dir>/other/*.jpg for non-crops (eval only);
    # the Wikimedia Commons files used are listed in photo-sources.json (not redistributed)
    uv run --with tokenizers --with onnxruntime --with numpy --with pillow \
      python build_label_embeddings.py .cache --photos path/to/photos [--eval path/to/photos]

Measured on 20 Sep 2026 over the 11 WFP Kenya crops, 110 Wikimedia Commons photos plus 6
non-crop photos, leave-one-out (each photo is scored against prototypes built without it):
  text only     top-1 62%, top-3 75%   (keypad camera 60% / 74%)
  text+photos   top-1 68%, top-3 91%   (keypad camera 65% / 88%)
The app shows the top three to confirm, so top-3 is the number that matters. All 6 non-crop
photos are rejected; the closest scores 43x past the gate of 10. Beans (rosecoco) are the weak
spot (5/17), confused with cowpeas and dolichos. The set is small and guided the wording, so
treat the figures as optimistic until field photos exist. --eval here scores the finished table
on the photos it was built from, which is optimistic again: a smoke test, not a measurement.
"""
import io, json, os, sys
import numpy as np
import onnxruntime as ort
from PIL import Image
from tokenizers import Tokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "public", "models", "label-embeddings.json")
# weight of the photo average against the text vector, and how much more a photo must look like a
# non-crop than like all crops together before it is turned away (chosen by leave-one-out above)
ALPHA = 1.0
GATE = 10

# Exactly the crops in app/lib/catalog.ts (the WFP Kenya list). Neighbours that look alike get
# wording that points at the difference: white vs red potato skin, rosecoco speckles vs the
# cowpea's black eye vs dolichos' black seed with a white stripe.
LABELS = {
    "maize": ["maize cobs", "dry maize grain", "corn kernels", "white maize cobs drying in the sun", "ears of corn"],
    "tomato": ["tomatoes", "fresh red tomatoes"],
    "potato": ["potatoes", "Irish potatoes", "white potatoes with pale brown skin", "brown potatoes in a sack"],
    "kale": ["collard greens", "kale leaves", "sukuma wiki leafy greens", "bunches of dark green leafy vegetables", "leafy greens tied in bundles at a market"],
    "onion": ["onions", "red onions"],
    "cabbage": ["cabbage", "round heads of cabbage"],
    "rice": ["uncooked white rice grains", "raw rice", "a sack of white rice", "long grain rice"],
    "beans": ["dry beans", "speckled rosecoco beans", "red and cream speckled kidney beans", "cranberry beans", "large mottled pink beans"],
    "cowpea": ["cowpeas", "black-eyed peas", "small cream beans with a black eye", "small kidney-shaped cowpea seeds"],
    "red-potato": ["red potatoes", "red-skinned potatoes", "potatoes with red skin"],
    "dolichos": ["black lablab beans", "njahi black beans", "hyacinth bean seeds", "shiny black beans with a white stripe", "dolichos lablab seeds"],
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



def photo_mean(vision, folder):
    """Average image embedding of a crop's photos, each seen full-size and through the keypad camera."""
    vecs = []
    for name in sorted(os.listdir(folder)):
        if name.lower().endswith((".jpg", ".jpeg", ".png")):
            im = Image.open(os.path.join(folder, name))
            for shot in (im, keypad_camera(im)):
                vecs.append(norm(vision.run(None, {"pixel_values": preprocess(shot)})[0])[0])
    return norm(np.mean(vecs, 0)) if vecs else None


def main():
    cache = sys.argv[1]
    tok = Tokenizer.from_file(os.path.join(cache, "tokenizer.json"))
    text = ort.InferenceSession(os.path.join(cache, "text_model.onnx"), providers=["CPUExecutionProvider"])
    ids = list(LABELS)
    gate_vecs = np.stack([
        norm(norm(text.run(None, {"input_ids": tokenize(tok, [t.format(p) for p in LABELS[c] for t in TEMPLATES])})[0]).mean(0))
        for c in ids
    ])
    label_vecs = gate_vecs
    if "--photos" in sys.argv:
        photos = sys.argv[sys.argv.index("--photos") + 1]
        vision = ort.InferenceSession(os.path.join(cache, "vision_model.onnx"), providers=["CPUExecutionProvider"])
        rows = []
        for c, g in zip(ids, gate_vecs):
            folder = os.path.join(photos, c)
            mean = photo_mean(vision, folder) if os.path.isdir(folder) else None
            print(f"{c:11s} {'photos' if mean is not None else 'text only'}")
            rows.append(norm(g + ALPHA * mean) if mean is not None else g)
        label_vecs = np.stack(rows)
    neg_vecs = norm(text.run(None, {"input_ids": tokenize(tok, NEGATIVES)})[0])
    r = lambda v: [round(float(x), 3) for x in v]  # 3 decimals: same answers, ~25% smaller file
    json.dump({
        "model": "Xenova/mobileclip_s0 (Apple MobileCLIP-S0)", "dim": int(label_vecs.shape[1]), "scale": 100, "input": 256,
        "gate": GATE,
        "labels": [{"id": c, "vec": r(v), "gate": r(g)} for c, v, g in zip(ids, label_vecs, gate_vecs)],
        "negatives": [r(v) for v in neg_vecs],
    }, open(OUT, "w"), separators=(",", ":"))
    print("wrote", os.path.normpath(OUT))

    if "--eval" in sys.argv:
        root = sys.argv[sys.argv.index("--eval") + 1]
        vision = ort.InferenceSession(os.path.join(cache, "vision_model.onnx"), providers=["CPUExecutionProvider"])
        gate_table = np.concatenate([gate_vecs, neg_vecs])
        for camera in ("full", "keypad"):
            n = top1 = top3 = rejected = others = 0
            for cls in sorted(os.listdir(root)):
                folder = os.path.join(root, cls)
                if not os.path.isdir(folder) or (cls != "other" and cls not in ids):
                    continue
                for name in sorted(os.listdir(folder)):
                    if not name.lower().endswith((".jpg", ".jpeg", ".png")):
                        continue
                    im = Image.open(os.path.join(folder, name))
                    v = norm(vision.run(None, {"pixel_values": preprocess(keypad_camera(im) if camera == "keypad" else im)})[0])[0]
                    g = 100.0 * gate_table @ v
                    gp = np.exp(g - g.max())
                    unknown = gp[len(ids):].sum() > GATE * gp[: len(ids)].sum()
                    p = 100.0 * label_vecs @ v
                    if cls == "other":
                        others += 1; rejected += int(unknown)
                        continue
                    order = [ids[i] for i in np.argsort(-p)[:3]]
                    n += 1; top1 += int(not unknown and order[0] == cls); top3 += int(not unknown and cls in order)
            print(f"{camera:7s} top1 {top1}/{n} = {top1 / max(n, 1):.1%}   top3 {top3}/{n} = {top3 / max(n, 1):.1%}   non-crop rejected {rejected}/{others}")


if __name__ == "__main__":
    main()
