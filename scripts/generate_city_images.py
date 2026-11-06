"""Erzeugt die Gebäude- und Dekorationsbilder für „Deine Stadt“ mit deinem lokalen ComfyUI.

Ablauf (wie bei den Wortbildern):
  1. ComfyUI starten:  S:\\ArtIsFantasy-AI-Studio\\START_ComfyUI_sicher.bat   (127.0.0.1:8188)
  2. Im Repo-Ordner ausführen:
       S:\\ArtIsFantasy-AI-Studio\\app\\ComfyUI_windows_portable\\python_embeded\\python.exe scripts\\generate_city_images.py
     Optionen:  --limit 3   nur 3 Bilder (zum Testen)      --redo   vorhandene Bilder neu erzeugen
  3. node scripts/generate-mobile-packs.mjs   → Bilder in die App übernehmen

13 Gebäude × 3 Stufen + 6 Dekorationen = 45 Bilder nach mobile/assets/city/<id>_<stufe>.png (320 x 320, transparent-freier
Himmel-Hintergrund in Nachtblau passt zum App-Design). Stil: freundliche isometrische Spielgebäude.
"""
import argparse
import io
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_word_images import call, render, workflow  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "mobile", "assets", "city")

STYLE = (
    "cute isometric cartoon game building, {subject}, {stage}, one single building centered, chunky friendly proportions, "
    "glossy toy-like shading, warm lights in the windows, small green lawn base, plain solid deep navy blue background (#0b1f63), "
    "mobile game asset, clean, no text, no letters, no watermark"
)
STAGES = {
    1: "small and simple starter version",
    2: "medium size with an extra floor and more details",
    3: "large grand fully upgraded version with decorations, flags and a shining roof",
}
BUILDINGS = {
    "bakery": "a bakery with a croissant sign and a striped awning",
    "station": "a train station with a small blue train in front",
    "house": "a cozy family house with a red roof and a garden",
    "office": "a modern office building with glass windows",
    "hospital": "a clinic with a red cross and an ambulance",
    "market": "a market hall with fruit and vegetable stalls",
    "park": "a park pavilion with trees, a bench and a lantern",
    "school": "a school building with a clock tower and a flag",
    "boutique": "a fashion boutique with a dress in the shop window",
    "cafe": "a cozy café with a coffee cup sign and outdoor tables",
    "townhall": "a town hall with columns, a dome and a flag",
    "radio": "a broadcasting station with a tall antenna tower",
    "theatre": "a theatre with red curtains, masks and a marquee",
}
DECORATIONS = {
    "fountain": "a stone fountain with sparkling blue water",
    "ferris": "a colorful ferris wheel",
    "statue": "a statue of a cute owl on a pedestal",
    "garden": "a flower garden with tulips and a small fence",
    "lighthouse": "a red and white lighthouse with a glowing lamp",
    "castle": "a fairytale castle with blue towers",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--server", default="http://127.0.0.1:8188")
    parser.add_argument("--model", default="flux1-schnell-fp8.safetensors")
    parser.add_argument("--size", type=int, default=768)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--redo", action="store_true")
    args = parser.parse_args()
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Pillow fehlt. Bitte mit der Python-Version von ComfyUI starten (python_embeded\\python.exe).")
    try:
        call(args.server, "/system_stats")
    except Exception as error:  # noqa: BLE001
        sys.exit(f"ComfyUI nicht erreichbar unter {args.server} ({error}).")
    os.makedirs(OUT_DIR, exist_ok=True)

    todo = []
    for building_id, subject in BUILDINGS.items():
        for stage, stage_text in STAGES.items():
            todo.append((f"{building_id}_{stage}", STYLE.format(subject=subject, stage=stage_text)))
    for decoration_id, subject in DECORATIONS.items():
        todo.append((f"{decoration_id}_1", STYLE.format(subject=subject, stage="charming fully built version")))
    todo = [(name, prompt) for name, prompt in todo if args.redo or not os.path.exists(os.path.join(OUT_DIR, f"{name}.png"))]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} Bilder zu erzeugen (Modell {args.model}).")
    for number, (name, prompt) in enumerate(todo, 1):
        started = time.time()
        try:
            png = render(args.server, workflow(prompt, args.model, random.randint(1, 2**31), args.size))
            image = Image.open(io.BytesIO(png)).convert("RGB").resize((320, 320), Image.LANCZOS)
            image.save(os.path.join(OUT_DIR, f"{name}.png"), "PNG", optimize=True)
            print(f"[{number}/{len(todo)}] {name}  ({time.time() - started:.1f}s)")
        except Exception as error:  # noqa: BLE001
            print(f"[{number}/{len(todo)}] {name}: FEHLER {error}")
    print("Fertig. Jetzt: node scripts/generate-mobile-packs.mjs")


if __name__ == "__main__":
    main()
