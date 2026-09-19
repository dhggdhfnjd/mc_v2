"use client";

// "Take a photo instead of typing." The screen only exists when the client reports ImageUpload.
// On Cloud Phone <input type="file"> opens the native full-screen picker (Phone / MemoryCard).
// The recogniser (lib/vision.ts) starts loading as soon as this screen opens, so it is usually
// ready by the time a photo has been chosen. The trader confirms one of three candidates with a
// single digit; "not a crop" or "none of these" hands over to the text grid instead.
// `then` is the view to open once the food is known, so this works as a filter for any of them.

import { useEffect, useRef, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row } from "../components/ui";
import { isDigit, type Key } from "../core/keypad";
import { useNav, type ScreenName } from "../core/router";
import { useSettings } from "../core/settings";
import { commodity } from "../lib/catalog";
import { visionProvider, type Candidate, type VisionProvider } from "../lib/vision";

type State =
  | { step: "idle" }
  | { step: "working"; url: string }
  | { step: "done"; candidates: Candidate[]; url: string }
  | { step: "unsure"; url: string }
  | { step: "error" };

let shared: VisionProvider | null = null;
const provider = () => (shared ??= visionProvider());

export default function Photo({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: "idle" });
  const [sel, setSel] = useState(0);
  const [warm, setWarm] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let alive = true;
    const p = provider();
    // 10% steps: every repaint is a screen update, and on Cloud Phone those cost the user data
    const onProgress = (f: number) => alive && setPct(Math.floor(f * 10) * 10);
    (p.prepare?.(onProgress) ?? Promise.resolve()).finally(() => alive && setWarm(true));
    // handle for automated checks: recognise an image by URL without the native file picker
    (window as unknown as { __mizaniRecognize?: unknown }).__mizaniRecognize = (url: string) =>
      fetch(url).then((r) => r.blob()).then((b) => p.recognize(b));
    return () => {
      alive = false;
    };
  }, []);

  const url = "url" in state ? state.url : null;
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setState({ step: "working", url: preview });
    try {
      const candidates = await provider().recognize(file);
      setSel(0);
      setState(candidates.length ? { step: "done", candidates, url: preview } : { step: "unsure", url: preview });
    } catch {
      setState({ step: "error" });
    }
  };

  const then = (params.then as ScreenName | undefined) ?? "food";

  const choose = (i: number) => {
    if (state.step !== "done" || !state.candidates[i]) return;
    const commodityId = state.candidates[i].commodityId;
    update({ foodId: commodityId });
    nav.replace(then, { commodityId });
  };

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return fileRef.current?.click(), true;
    if (key === "0") return nav.replace("pick", { then }), true;
    if (state.step !== "done") {
      if (key === "OK") return fileRef.current?.click(), true;
      return false;
    }
    if (key === "Up" || key === "Down") return setSel((s) => (s + (key === "Down" ? 1 : state.candidates.length - 1)) % state.candidates.length), true;
    if (key === "OK") return choose(sel), true;
    if (isDigit(key)) return choose(Number(key) - 1), true;
    return false;
  };

  return (
    <Screen active={active} title={t("isThis")} soft={{ l: t("photo"), c: t("ok") }} onKey={onKey}>
      <div className="thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url ? <img src={url} alt="" /> : `OK → ${t("photo")}`}
      </div>
      {state.step === "idle" ? <div className="mut">{warm ? t("visionReady") : `${t("visionLoading")} ${pct}%`}</div> : null}
      {state.step === "working" ? <div className="mut">{warm ? t("visionWorking") : `${t("visionLoading")} ${pct}%`}</div> : null}
      {state.step === "error" ? <div className="vd bad">{t("photoFail")}</div> : null}
      {state.step === "unsure" ? <div className="vd fair">{t("notSure")}</div> : null}
      {state.step === "done"
        ? state.candidates.map((cand, i) => {
            const c = commodity(cand.commodityId);
            return <Row key={c.id} on={i === sel} l={`${i + 1} ${c.icon} ${settings.lang === "sw" ? c.sw : c.en}`} r={`${Math.round(cand.confidence * 100)}%`} />;
          })
        : null}
      {state.step === "done" || state.step === "unsure" ? (
        <>
          <Hr />
          <Row mut l={`0 ${t("none")}`} />
        </>
      ) : null}
      {warm && !provider().isModel ? <div className="mut">{t("demoVision")}</div> : null}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </Screen>
  );
}
