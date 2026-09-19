// Photo → commodity.
//
// Three interchangeable providers behind one interface:
//   1. ClipRecognizer   — Apple MobileCLIP-S0 image encoder running in the page through ONNX
//                         Runtime Web (WASM). Zero-shot: the 18 catalog crops are described in
//                         text, embedded offline (tools/vision), and shipped as a small JSON, so
//                         the browser only needs the image encoder. On Cloud Phone "the page"
//                         runs in CloudMosa's data centre, so neither the 23 MB model nor the
//                         inference costs the handset any data or CPU.
//   2. HttpRecognizer   — same contract over POST /v1/recognize (server/ in this repo), used when
//                         NEXT_PUBLIC_API_BASE is set.
//   3. ColourRecognizer — a colour histogram. Only a last resort when the model cannot load.
//
// Why not YOLO: stock YOLO knows the 80 COCO classes (banana, broccoli, carrot…) and none of
// maize, beans, omena or matooke. An open-vocabulary model needs no training data for them.

import type * as Ort from "onnxruntime-web";
import { COMMODITIES } from "./catalog";

export interface Candidate {
  commodityId: string;
  confidence: number; // 0..1, shares among the catalog crops
}

export type Progress = (fraction: number) => void;

export interface VisionProvider {
  readonly name: string;
  /** false for the colour fallback, so the UI can say the guess is weak */
  readonly isModel: boolean;
  /** optional warm-up so the model is ready before the user has picked a photo */
  prepare?(onProgress?: Progress): Promise<void>;
  /** best three crops; an empty list means "this does not look like any crop we know" */
  recognize(image: Blob): Promise<Candidate[]>;
}

const SIZE = 256;

/** Centre-crop to a square and scale to `size`, as the model's preprocessor does. */
async function squarePixels(file: Blob, size: number): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return ctx.getImageData(0, 0, size, size);
}

/** Longest side 512 px, JPEG 0.7; re-encoding also drops EXIF (location, device). */
export async function downscale(file: Blob, max = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the photo"))), "image/jpeg", 0.7),
  );
}

// ---------------------------------------------------------------------------------------------
// 1. MobileCLIP in the page

interface LabelTable {
  scale: number;
  input: number;
  labels: { id: string; vec: number[] }[];
  negatives: number[][];
}

/** Turn similarities into a ranked answer. Exported for tests: no browser APIs involved. */
export function rank(embedding: ArrayLike<number>, table: LabelTable): Candidate[] {
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) norm += embedding[i] * embedding[i];
  norm = Math.sqrt(norm) || 1;
  const dot = (vec: number[]) => {
    let s = 0;
    for (let i = 0; i < vec.length; i++) s += vec[i] * embedding[i];
    return (table.scale * s) / norm;
  };
  const crop = table.labels.map((l) => dot(l.vec));
  const other = table.negatives.map(dot);
  const top = Math.max(...crop, ...other);
  const cropMass = crop.map((z) => Math.exp(z - top));
  const cropSum = cropMass.reduce((s, v) => s + v, 0);
  const otherSum = other.reduce((s, z) => s + Math.exp(z - top), 0);
  // more weight on "a person / a room / a document…" than on all crops together → not a crop
  if (otherSum > cropSum) return [];
  return table.labels
    .map((l, i) => ({ commodityId: l.id, confidence: cropMass[i] / cropSum }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

// Sizes are fixed at build time; Content-Length is useless for progress when the host gzips.
const MODEL = { path: "/models/mobileclip_s0_vision.onnx?v=1", bytes: 22_869_662 };
const WASM = { path: "/ort/ort-wasm-simd-threaded.wasm", bytes: 14_239_897 };

/** Stream a file so a phone on a slow network can show how far along it is. */
async function download(url: string, onBytes: (n: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not load ${url} (${res.status})`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded) return resolve();
    const el = existing ?? document.createElement("script");
    el.addEventListener("load", () => ((el.dataset.loaded = "1"), resolve()));
    el.addEventListener("error", () => reject(new Error(`Could not load ${src}`)));
    if (!existing) {
      el.src = src;
      el.async = true;
      document.head.appendChild(el);
    }
  });
}

export class ClipRecognizer implements VisionProvider {
  readonly name = "MobileCLIP-S0, in the browser";
  readonly isModel = true;
  private ready: Promise<{ ort: typeof Ort; session: Ort.InferenceSession; table: LabelTable }> | null = null;
  private loaded = 0;
  private readonly listeners = new Set<Progress>();

  constructor(private readonly base: string) {}

  prepare(onProgress?: Progress): Promise<void> {
    if (onProgress) {
      this.listeners.add(onProgress);
      onProgress(this.fraction());
    }
    return this.load().then(() => undefined);
  }

  private fraction() {
    return Math.min(1, this.loaded / (MODEL.bytes + WASM.bytes));
  }

  private load() {
    this.ready ??= (async () => {
      const count = (n: number) => {
        this.loaded += n;
        const f = Math.min(0.99, this.fraction()); // 100% is announced once the session exists
        this.listeners.forEach((l) => l(f));
      };
      // The runtime and the model come from our own origin, on demand (scripts/copy-ort.mjs),
      // so none of this weighs on the app's first paint. Both are fetched here, not by ONNX
      // Runtime, so that a phone on a slow network can show progress.
      const [, model, wasm, table] = await Promise.all([
        loadScript(`${this.base}/ort/ort.wasm.min.js`),
        download(`${this.base}${MODEL.path}`, count),
        download(`${this.base}${WASM.path}`, count),
        fetch(`${this.base}/models/label-embeddings.json`).then((r) => {
          if (!r.ok) throw new Error(`label table ${r.status}`);
          return r.json() as Promise<LabelTable>;
        }),
      ]);
      const ort = (window as unknown as { ort: typeof Ort }).ort;
      ort.env.wasm.wasmPaths = `${this.base}/ort/`;
      ort.env.wasm.wasmBinary = wasm.buffer as ArrayBuffer;
      ort.env.wasm.numThreads = 1; // GitHub Pages cannot send the COOP/COEP headers threads need
      const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
      this.loaded = MODEL.bytes + WASM.bytes;
      this.listeners.forEach((l) => l(1));
      return { ort, session, table };
    })().catch((e) => {
      this.ready = null; // let a later attempt retry
      this.loaded = 0;
      throw e;
    });
    return this.ready;
  }

  async recognize(image: Blob): Promise<Candidate[]> {
    const { ort, session, table } = await this.load();
    const { data } = await squarePixels(image, SIZE);
    const plane = SIZE * SIZE;
    const input = new Float32Array(3 * plane); // RGB planes, 0..1, no mean/std for MobileCLIP
    for (let i = 0; i < plane; i++) {
      input[i] = data[i * 4] / 255;
      input[plane + i] = data[i * 4 + 1] / 255;
      input[2 * plane + i] = data[i * 4 + 2] / 255;
    }
    const output = await session.run({ pixel_values: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
    const known = new Set(COMMODITIES.filter((c) => c.photo).map((c) => c.id));
    return rank(output.image_embeds.data as Float32Array, table).filter((c) => known.has(c.commodityId));
  }
}

// ---------------------------------------------------------------------------------------------
// 2. The same model behind an API

export class HttpRecognizer implements VisionProvider {
  readonly name = "vision API";
  readonly isModel = true;
  constructor(private readonly base: string) {}

  async recognize(image: Blob): Promise<Candidate[]> {
    const body = new FormData();
    body.append("image", await downscale(image), "photo.jpg");
    const res = await fetch(`${this.base}/v1/recognize`, { method: "POST", body });
    if (!res.ok) throw new Error(`Recognition failed (${res.status})`);
    const json = (await res.json()) as { candidates: Candidate[] };
    const known = new Set(COMMODITIES.filter((c) => c.photo).map((c) => c.id));
    return json.candidates.filter((c) => known.has(c.commodityId)).slice(0, 3);
  }
}

// ---------------------------------------------------------------------------------------------
// 3. Last resort: colour histogram

type ColourClass = "red" | "yellow" | "green" | "brown" | "pale" | "dark";

const BY_COLOUR: Record<ColourClass, string[]> = {
  red: ["tomato", "onion"],
  yellow: ["maize", "potato"],
  green: ["cabbage", "kale"],
  brown: ["potato", "beans"],
  pale: ["rice", "onion"],
  dark: ["beans"],
};

function classify(r: number, g: number, b: number): ColourClass {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  if (v < 0.22) return "dark";
  if (s < 0.18) return v > 0.6 ? "pale" : "dark";
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  if (h < 18 || h >= 335) return "red";
  if (h < 40) return s > 0.55 && v > 0.55 ? "yellow" : "brown";
  if (h < 70) return "yellow";
  if (h < 170) return "green";
  return s < 0.35 ? "pale" : "dark";
}

export class ColourRecognizer implements VisionProvider {
  readonly name = "colour guess";
  readonly isModel = false;

  async recognize(image: Blob): Promise<Candidate[]> {
    const { data, width, height } = await squarePixels(image, 64);
    const votes = new Map<ColourClass, number>();
    let total = 0;
    for (let y = Math.floor(height * 0.2); y < height * 0.8; y++) {
      for (let x = Math.floor(width * 0.2); x < width * 0.8; x++) {
        const i = (y * width + x) * 4;
        const cls = classify(data[i], data[i + 1], data[i + 2]);
        votes.set(cls, (votes.get(cls) ?? 0) + 1);
        total++;
      }
    }
    const score = new Map<string, number>();
    for (const [cls, n] of votes) {
      BY_COLOUR[cls].forEach((id, position) => score.set(id, (score.get(id) ?? 0) + n / Math.max(1, total) / (position + 1)));
    }
    const sum = [...score.values()].reduce((s, v) => s + v, 0) || 1;
    return [...score.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([commodityId, v]) => ({ commodityId, confidence: v / sum }));
  }
}

/** Try the real model; if it cannot load (blocked WASM, no memory, network), degrade instead of failing. */
export class WithFallback implements VisionProvider {
  private failed = false;
  constructor(private readonly primary: VisionProvider, private readonly fallback: VisionProvider) {}

  get name() {
    return this.failed ? this.fallback.name : this.primary.name;
  }
  get isModel() {
    return this.failed ? this.fallback.isModel : this.primary.isModel;
  }

  async prepare(onProgress?: Progress): Promise<void> {
    try {
      await this.primary.prepare?.(onProgress);
    } catch {
      this.failed = true;
    }
  }

  async recognize(image: Blob): Promise<Candidate[]> {
    if (!this.failed) {
      try {
        return await this.primary.recognize(image);
      } catch {
        this.failed = true;
      }
    }
    return this.fallback.recognize(image);
  }
}

export function visionProvider(): VisionProvider {
  const api = process.env.NEXT_PUBLIC_API_BASE;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return new WithFallback(api ? new HttpRecognizer(api) : new ClipRecognizer(base), new ColourRecognizer());
}
