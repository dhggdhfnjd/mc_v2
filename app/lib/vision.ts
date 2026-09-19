// Photo → commodity. The production design (architecture §6) sends a downscaled JPEG to
// POST /v1/recognize, where a vision model may only answer with ids from our catalog.
// Without a backend, the prototype ships a colour-histogram recogniser that runs in the page:
// crude, but it exercises the whole flow (pick file → downscale → top-3 → confirm with 1/2/3).

import { COMMODITIES } from "./catalog";

export interface Candidate {
  commodityId: string;
  confidence: number; // 0..1
}

export interface VisionProvider {
  readonly name: string;
  recognize(image: Blob): Promise<Candidate[]>;
}

/** Longest side 512 px, JPEG 0.7, metadata dropped by the re-encode. */
export async function downscale(file: Blob, max = 512): Promise<{ blob: Blob; pixels: ImageData }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the photo"))), "image/jpeg", 0.7),
  );
  return { blob, pixels: ctx.getImageData(0, 0, w, h) };
}

type ColourClass = "red" | "yellow" | "green" | "brown" | "pale" | "dark";

const BY_COLOUR: Record<ColourClass, string[]> = {
  red: ["tomato", "pepper", "onion", "melon"],
  yellow: ["maize", "banana", "potato", "millet"],
  green: ["cabbage", "kale", "matooke", "melon", "ndengu"],
  brown: ["potato", "cassava", "gnuts", "beans", "sorghum"],
  pale: ["rice", "omena", "cassava", "onion"],
  dark: ["beans", "sorghum", "omena", "millet"],
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

/** Votes from the centre of the frame, where a hand-held subject usually is. */
export class ColourRecognizer implements VisionProvider {
  readonly name = "on-device colour demo";

  async recognize(image: Blob): Promise<Candidate[]> {
    const { pixels } = await downscale(image, 64);
    return this.fromPixels(pixels);
  }

  fromPixels(pixels: ImageData): Candidate[] {
    const { data, width, height } = pixels;
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
      BY_COLOUR[cls].forEach((id, rank) => {
        score.set(id, (score.get(id) ?? 0) + (n / Math.max(1, total)) / (rank + 1));
      });
    }
    const sum = [...score.values()].reduce((s, v) => s + v, 0) || 1;
    return [...score.entries()]
      .filter(([id]) => COMMODITIES.some((c) => c.id === id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([commodityId, v]) => ({ commodityId, confidence: v / sum }));
  }
}

/** Production path: the Worker forwards to a vision model constrained to catalog ids. */
export class HttpRecognizer implements VisionProvider {
  readonly name = "vision API";
  constructor(private readonly base: string) {}

  async recognize(image: Blob): Promise<Candidate[]> {
    const { blob } = await downscale(image);
    const body = new FormData();
    body.append("image", blob, "photo.jpg");
    const res = await fetch(`${this.base}/v1/recognize`, { method: "POST", body });
    if (!res.ok) throw new Error(`Recognition failed (${res.status})`);
    const json = (await res.json()) as { candidates: Candidate[] };
    const known = new Set(COMMODITIES.map((c) => c.id));
    return json.candidates.filter((c) => known.has(c.commodityId)).slice(0, 3);
  }
}

export function visionProvider(): VisionProvider {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  return base ? new HttpRecognizer(base) : new ColourRecognizer();
}
