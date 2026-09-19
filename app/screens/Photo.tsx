"use client";

// "Take a photo instead of typing." The screen only exists when the client reports ImageUpload.
// On Cloud Phone <input type="file"> opens the native full-screen picker (Phone / MemoryCard);
// the image is downscaled inside the cloud browser, recognised, and the trader confirms one of
// three candidates with a single digit. Low confidence, or "none of these", drops back to the grid.

import { useEffect, useRef, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row } from "../components/ui";
import { isDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { commodity } from "../lib/catalog";
import { visionProvider, type Candidate } from "../lib/vision";

type State = { step: "idle" } | { step: "working" } | { step: "done"; candidates: Candidate[]; url: string } | { step: "error" };

export default function Photo({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ step: "idle" });
  const [sel, setSel] = useState(0);
  const provider = useRef(visionProvider());

  useEffect(() => () => void (state.step === "done" && URL.revokeObjectURL(state.url)), [state]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setState({ step: "working" });
    try {
      const candidates = await provider.current.recognize(file);
      if (candidates.length === 0) throw new Error("no candidates");
      setSel(0);
      setState({ step: "done", candidates, url: URL.createObjectURL(file) });
    } catch {
      setState({ step: "error" });
    }
  };

  const choose = (i: number) => {
    if (state.step !== "done" || !state.candidates[i]) return;
    const commodityId = state.candidates[i].commodityId;
    if (settings.marketId) nav.replace("price", { commodityId });
    else nav.replace("area", { then: commodityId });
  };

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return fileRef.current?.click(), true;
    if (state.step !== "done") {
      if (key === "OK") return fileRef.current?.click(), true;
      return false;
    }
    if (key === "Up" || key === "Down") return setSel((s) => (s + (key === "Down" ? 1 : state.candidates.length - 1)) % state.candidates.length), true;
    if (key === "OK") return choose(sel), true;
    if (isDigit(key)) {
      if (key === "0") nav.back();
      else choose(Number(key) - 1);
      return true;
    }
    return false;
  };

  return (
    <Screen active={active} title={t("isThis")} soft={{ l: t("photo"), c: t("ok") }} onKey={onKey}>
      <div className="thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {state.step === "done" ? <img src={state.url} alt="" /> : state.step === "working" ? "…" : `OK → ${t("photo")}`}
      </div>
      {state.step === "error" ? <div className="vd bad">{t("photoFail")}</div> : null}
      {state.step === "done" ? (
        <>
          {state.candidates.map((cand, i) => {
            const c = commodity(cand.commodityId);
            return <Row key={c.id} on={i === sel} l={`${i + 1} ${c.icon} ${settings.lang === "sw" ? c.sw : c.en}`} r={`${Math.round(cand.confidence * 100)}%`} />;
          })}
          <Hr />
          <Row mut l={`0 ${t("none")}`} />
        </>
      ) : null}
      <div className="mut">{provider.current.name === "vision API" ? "" : t("demoVision")}</div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
    </Screen>
  );
}
