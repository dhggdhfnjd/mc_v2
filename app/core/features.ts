/// <reference types="@cloudmosa-inc/cloudphone-types" />
"use client";

// Capability detection. On Cloud Phone, navigator.hasFeature() says what this client version
// can do (the test handset runs client 2.5: no tel: links, image upload to be confirmed on the
// device, and the simulator supports no uploads at all). On an ordinary browser the method does
// not exist, so we fall back to what a desktop or smartphone browser can do.

import { useEffect, useState } from "react";

export type Feature = "ImageUpload" | "TelScheme" | "SmsScheme" | "Vibrate";

const DESKTOP_DEFAULT: Record<Feature, boolean> = {
  ImageUpload: true,
  TelScheme: true,
  SmsScheme: true,
  Vibrate: false,
};

export const isCloudPhone = (): boolean =>
  typeof navigator !== "undefined" && typeof navigator.hasFeature === "function";

const cache = new Map<Feature, Promise<boolean>>();

export function hasFeature(name: Feature): Promise<boolean> {
  let hit = cache.get(name);
  if (!hit) {
    hit = isCloudPhone()
      ? navigator.hasFeature(name).catch(() => false)
      : Promise.resolve(DESKTOP_DEFAULT[name]);
    cache.set(name, hit);
  }
  return hit;
}

/** false until detection resolves, so a control never appears and then vanishes */
export function useFeature(name: Feature): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let alive = true;
    hasFeature(name).then((v) => alive && setOk(v));
    return () => {
      alive = false;
    };
  }, [name]);
  return ok;
}
