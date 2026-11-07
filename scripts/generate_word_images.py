"""Erzeugt Bilder für die Lernkarten von Lingo Pro mit deinem lokalen ComfyUI (ArtIsFantasy-AI-Studio).

Ablauf:
  1. ComfyUI starten:  S:\\ArtIsFantasy-AI-Studio\\START_ComfyUI.bat   (läuft auf 127.0.0.1:8188)
  2. Im Repo-Ordner ausführen (die Python-Version von ComfyUI bringt Pillow schon mit):
       S:\\ArtIsFantasy-AI-Studio\\app\\ComfyUI_windows_portable\\python_embeded\\python.exe scripts\\generate_word_images.py
     Optionen:  --limit 10   nur 10 Bilder (zum Testen)
                --level A1   nur ein Level
                --redo       vorhandene Bilder neu erzeugen
                --model flux1-schnell-fp8.safetensors   anderes Checkpoint-Modell
  3. node scripts/generate-mobile-packs.mjs   → Bilder in die App übernehmen

Was gemalt wird, steht in content/vokabeln.csv in der Spalte "bild_prompt" (Standard: das englische Wort).
"-" in bild_prompt = für dieses Wort kein Bild. Fertige Bilder: mobile/assets/word-images/<wort_id>.jpg (384 x 384).
"""
import argparse
import csv
import io
import json
import os
import random
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "content", "vokabeln.csv")
OUT_DIR = os.path.join(ROOT, "mobile", "assets", "word-images")
STYLE = (
    "cute flat vector illustration of {subject}, one single subject centered, simple shapes, soft pastel colors, "
    "plain white background, friendly children's book style, clean, no text, no letters, no watermark"
)


def workflow(prompt, model, seed, size):
    """Flux schnell (all-in-one checkpoint): 4 steps, cfg 1 – fast on an RTX 3060."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {"class_type": "EmptySD3LatentImage", "inputs": {"width": size, "height": size, "batch_size": 1}},
        "5": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0],
                                                  "seed": seed, "steps": 4, "cfg": 1.0, "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": "lingopro/word"}},
    }


def call(server, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(f"{server}{path}", data=data, headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
    return json.loads(body) if body[:1] in (b"{", b"[") else body


def render(server, graph, attempts=4):
    """Renders one image. ComfyUI's disk streaming sometimes fails while a model is still loading
    (Windows error 1450 / hostbuf_file_reader_read); those attempts are simply retried."""
    last_error = None
    for attempt in range(attempts):
        try:
            return render_once(server, graph)
        except (RuntimeError, TimeoutError) as error:
            last_error = error
            if attempt < attempts - 1:
                time.sleep(3 + attempt * 2)
    raise last_error


def render_once(server, graph):
    prompt_id = call(server, "/prompt", {"prompt": graph, "client_id": "lingopro"})["prompt_id"]
    for _ in range(600):
        history = call(server, f"/history/{prompt_id}")
        if prompt_id in history:
            entry = history[prompt_id]
            if entry.get("status", {}).get("status_str") == "error":
                # Show the real reason (e.g. "out of memory"), not the whole event log.
                for kind, payload in entry["status"].get("messages", []):
                    if kind == "execution_error":
                        raise RuntimeError(f"{payload.get('node_type')}: {payload.get('exception_message', '')[:300]}")
                raise RuntimeError(json.dumps(entry["status"])[:400])
            for output in entry["outputs"].values():
                for image in output.get("images", []):
                    query = urllib.parse.urlencode({"filename": image["filename"], "subfolder": image["subfolder"], "type": image["type"]})
                    return call(server, f"/view?{query}")
        time.sleep(0.5)
    raise TimeoutError("ComfyUI hat nicht rechtzeitig geantwortet")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--server", default="http://127.0.0.1:8188")
    parser.add_argument("--model", default="flux1-schnell-fp8.safetensors")
    parser.add_argument("--size", type=int, default=768, help="Rendergröße (wird auf 384 verkleinert)")
    parser.add_argument("--level", help="nur dieses Level, z. B. A1")
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
        sys.exit(f"ComfyUI nicht erreichbar unter {args.server} ({error}). Erst START_ComfyUI.bat starten.")

    with open(CSV_PATH, encoding="utf-8-sig", newline="") as handle:
        sample = handle.readline()
        handle.seek(0)
        rows = list(csv.DictReader(handle, delimiter=";" if ";" in sample else ","))
    os.makedirs(OUT_DIR, exist_ok=True)

    todo, seen = [], set()
    for row in rows:
        word_id = row["wort_id"].strip()
        subject = (row.get("bild_prompt") or row.get("en") or row["de"]).strip()
        if not word_id or word_id in seen or subject == "-":
            continue
        if args.level and row["level"].strip().upper() != args.level.upper():
            continue
        seen.add(word_id)
        target = os.path.join(OUT_DIR, f"{word_id}.jpg")
        if os.path.exists(target) and not args.redo:
            continue
        todo.append((word_id, subject, target))
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(todo)} Bilder zu erzeugen (Modell {args.model}).")

    for number, (word_id, subject, target) in enumerate(todo, 1):
        started = time.time()
        try:
            png = render(args.server, workflow(STYLE.format(subject=subject), args.model, random.randint(1, 2**31), args.size))
            image = Image.open(io.BytesIO(png)).convert("RGB").resize((384, 384), Image.LANCZOS)
            image.save(target, "JPEG", quality=82, optimize=True)
            print(f"[{number}/{len(todo)}] {word_id}: {subject}  ({time.time() - started:.1f}s)")
        except Exception as error:  # noqa: BLE001
            print(f"[{number}/{len(todo)}] {word_id}: FEHLER {error}")
    print("Fertig. Jetzt: node scripts/generate-mobile-packs.mjs")


if __name__ == "__main__":
    main()
