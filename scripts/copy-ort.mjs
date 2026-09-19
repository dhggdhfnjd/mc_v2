// Copies the ONNX Runtime Web (WASM-only) runtime into public/ort so it is served from our own
// origin. Loaded on demand by app/lib/vision.ts — it never enters the main bundle.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "onnxruntime-web", "dist");
const to = join(root, "public", "ort");
mkdirSync(to, { recursive: true });
for (const file of ["ort.wasm.min.js", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  cpSync(join(from, file), join(to, file));
}
console.log("onnxruntime-web runtime copied to public/ort");
