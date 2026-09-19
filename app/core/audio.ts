"use client";

// Audio mode: speak a product's name when the highlight lands on it, for traders who read
// slowly or not at all. Cloud Phone plays <audio> but has no speech synthesis, so every name is a
// recorded clip in public/audio/<lang>/<id>.mp3 (tools/audio/build_food_audio.py). One element is
// reused, and a new name cuts off the previous one, so holding an arrow key never queues a list.

import type { Lang } from "./i18n";
import { hasFeature } from "./features";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
let player: HTMLAudioElement | null = null;

export function sayFood(lang: Lang, commodityId: string): void {
  if (typeof Audio === "undefined") return;
  void hasFeature("AudioPlay").then((ok) => {
    if (!ok) return;
    player ??= new Audio();
    player.pause();
    player.src = `${base}/audio/${lang}/${encodeURIComponent(commodityId)}.mp3`;
    // a missing clip or a blocked autoplay must never break navigation
    player.play().catch(() => undefined);
  });
}
