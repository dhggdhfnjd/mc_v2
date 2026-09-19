"""Record the spoken name of every product for audio mode.

Cloud Phone plays <audio> but has no speech synthesis, so each name is a small MP3 in
public/audio/<lang>/<commodity id>.mp3, made once here and committed. Names and ids are read from
app/lib/catalog.ts so a new product only needs this script re-run.

    python3 -m venv .venv && .venv/bin/pip install edge-tts
    .venv/bin/python tools/audio/build_food_audio.py

edge-tts sends each name to Microsoft's online voice service. The Kiswahili clips still need
native review, like every Kiswahili string in the app.
"""

import asyncio
import re
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "app/lib/catalog.ts"
OUT = ROOT / "public/audio"
# Kenyan voices for both languages, the accents a trader at Busia hears every day
VOICES = {"en": "en-KE-AsiliaNeural", "sw": "sw-KE-ZuriNeural"}
ENTRY = re.compile(r'\{ id: "([^"]+)", en: "([^"]+)", sw: "([^"]+)"')


async def main() -> None:
    products = ENTRY.findall(CATALOG.read_text())
    if not products:
        raise SystemExit(f"no products found in {CATALOG}")
    for lang, voice in VOICES.items():
        (OUT / lang).mkdir(parents=True, exist_ok=True)
        for pid, en, sw in products:
            name = en if lang == "en" else sw
            path = OUT / lang / f"{pid}.mp3"
            await edge_tts.Communicate(name, voice).save(str(path))
            print(f"{path.relative_to(ROOT)}  {name}")


asyncio.run(main())
