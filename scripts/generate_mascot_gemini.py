#!/usr/bin/env python3
"""Generate Kwagi reference images or page-mascot sprite sheets using Gemini API.

Supports:
1. Three Reference Poses (neutral, greeting, thinking) aligned with MASCOT.md into assets/mascot/reference/
2. Full page-mascot 3x3 Sprite Sheets (directions & reactions) into characters/kwagi/

Usage:
    python scripts/generate_mascot_gemini.py --poses
    python scripts/generate_mascot_gemini.py --sheets
    python scripts/generate_mascot_gemini.py --all
"""
import argparse
import base64
import os
import sys
from pathlib import Path

# Try importing google-genai
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

# Fallback to requests if google-genai isn't installed
import requests

ROOT = Path(__file__).resolve().parent.parent
REFERENCE_DIR = ROOT / "assets" / "mascot" / "reference"
CHARACTERS_DIR = ROOT / "characters" / "kwagi"

# Model candidates for Gemini Developer API (Nano Banana Flash / Pro)
DEFAULT_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image")
PRO_MODEL = "gemini-3-pro-image-preview"

# Prompts strictly adhering to MASCOT.md and page-mascot style
KWAGI_PROMPTS = {
    "neutral": """Cute storybook sticker art of Kwagi, a modern Philippine scops owl mascot. Clean bold black outlines with subtle weight variation (#102A2D), big round warm amber eyes (#F5A323) with bright white catchlights, dark pupils (#172326), small orange beak (#EF941D), with smooth round eye outlines, no eyelashes and no cheek blush. Compact rounded body with two distinct short pointed ear tufts at the crown. Rich deep teal plumage (#285F67) with mid-teal folded wings (#347580) showing subtle feather lines (#0F766E). Pale mint heart-shaped face disc and chest patch (#CFEED7), wearing a neat small minimalist black necktie (#172326) resting on his chest patch, and mid-teal three-toed feet (#2B7F74).

Pose: Upright resting neutral pose, facing straight forward at the viewer with wings folded neatly at his sides, calm, watchful and reassuring expression. Solid pure white background (#FFFFFF), high resolution, vector sticker aesthetic, no 3D shading, no photorealism.""",

    "greeting": """Cute storybook sticker art of Kwagi, a modern Philippine scops owl mascot. Same character consistency: clean bold dark outlines (#102A2D), big round warm amber eyes (#F5A323) with bright white catchlights, dark pupils (#172326), small orange beak (#EF941D), no eyelashes, no cheek blush, two short ear tufts, deep teal body (#285F67), mid-teal wings (#347580), pale mint face disc and chest patch (#CFEED7), small black necktie (#172326), and mid-teal feet (#2B7F74).

Pose: Facing the viewer, right wing folded, left wing lifted in a friendly welcoming gentle wave. Warm, approachable and reassuring expression. Solid pure white background (#FFFFFF), high resolution, vector sticker aesthetic, no 3D shading, no photorealism.""",

    "thinking": """Cute storybook sticker art of Kwagi, a modern Philippine scops owl mascot. Same character consistency: clean bold dark outlines (#102A2D), big round warm amber eyes (#F5A323) with bright white catchlights, dark pupils (#172326), small orange beak (#EF941D), no eyelashes, no cheek blush, two short ear tufts, deep teal body (#285F67), mid-teal wings (#347580), pale mint face disc and chest patch (#CFEED7), small black necktie (#172326), and mid-teal feet (#2B7F74).

Pose: In contemplation. Head slightly tilted, eyes looking upward and slightly to the side in thoughtful concentration, one wing raised gently to tap his chin or lower beak. Quiet, intelligent and focused. Solid pure white background (#FFFFFF), high resolution, vector sticker aesthetic, no 3D shading, no photorealism."""
}

# Saved prompts are the source of truth for future optional raster generations.
# This API path uses a solid key colour; built-in imagegen supports real alpha.
# Remove the key with page-mascot's key.py before using the generated sheets.
DIRECTIONS_PROMPT = (CHARACTERS_DIR / "PROMPT-directions.txt").read_text().replace(
    "Real transparent background.",
    "Solid uniform bright green (#00FF00) background covering the entire canvas.",
).replace("15 percent clear margin", "15 percent clear green margin")
REACTIONS_PROMPT = (CHARACTERS_DIR / "PROMPT-expressions.txt").read_text().replace(
    "Real transparent background;",
    "Solid uniform bright green (#00FF00) background covering the entire canvas;",
)


def get_api_key(cli_key=None):
    if cli_key:
        return cli_key
    key = os.environ.get("GEMINI_API_KEY")
    if key:
        return key
    # Check .env in root
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("GEMINI_API_KEY="):
                return line.split("=", 1)[1].strip("\"'")
    return None


def generate_image_genai(client, api_key, prompt, output_path, model=DEFAULT_MODEL, reference_image=None):
    """Generate image using google-genai SDK generate_content or REST fallback."""
    print(f"Generating image with model {model}...")

    # For imagen models in Developer API mode, generate_images raises ValueError.
    # Use REST predict endpoint for imagen models:
    if "imagen" in model.lower():
        return generate_image_rest(api_key, prompt, output_path, model=model, reference_image=reference_image)

    # For gemini-2.5-flash-image / gemini-3-pro-image-preview:
    contents = [prompt]
    if reference_image and Path(reference_image).exists():
        ref_bytes = Path(reference_image).read_bytes()
        contents.append(types.Part.from_bytes(data=ref_bytes, mime_type="image/png"))

    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                image_config=types.ImageConfig(aspect_ratio="1:1"),
                safety_settings=[
                    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_ONLY_HIGH"),
                    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_ONLY_HIGH"),
                    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_ONLY_HIGH"),
                    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_ONLY_HIGH"),
                ]
            )
        )
        # Extract image bytes
        image_bytes = None
        if response.candidates:
            for part in response.candidates[0].content.parts:
                if hasattr(part, "inline_data") and part.inline_data:
                    image_bytes = part.inline_data.data
                    break

        if not image_bytes:
            raise RuntimeError(f"Model {model} did not return image data. Response: {response}")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(image_bytes)
        print(f" Saved: {output_path} ({len(image_bytes) // 1024} KB)")

    except Exception as e:
        print(f"generate_content failed ({e}), falling back to REST endpoint...")
        generate_image_rest(api_key, prompt, output_path, model=model, reference_image=reference_image)


def generate_image_rest(api_key, prompt, output_path, model=DEFAULT_MODEL, reference_image=None):
    """Generate image using direct Google Generative Language REST API."""
    print(f"Calling REST API for model {model}...")
    if "imagen" in model:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:predict?key={api_key}"
        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": "1:1",
                "outputMimeType": "image/jpeg"
            }
        }
        res = requests.post(url, json=payload, timeout=90)
        if res.status_code != 200:
            raise RuntimeError(f"API Error ({res.status_code}): {res.text}")
        data = res.json()
        b64 = data["predictions"][0]["bytesBase64Encoded"]
        image_bytes = base64.b64decode(b64)
    else:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        parts = [{"text": prompt}]
        if reference_image and Path(reference_image).exists():
            ref_b64 = base64.b64encode(Path(reference_image).read_bytes()).decode("utf-8")
            parts.append({
                "inline_data": {
                    "mime_type": "image/png",
                    "data": ref_b64
                }
            })
        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": {
                "responseModalities": ["IMAGE", "TEXT"]
            }
        }
        res = requests.post(url, json=payload, timeout=90)
        if res.status_code != 200:
            raise RuntimeError(f"API Error ({res.status_code}): {res.text}")
        data = res.json()
        image_bytes = None
        for candidate in data.get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                if "inlineData" in part:
                    image_bytes = base64.b64decode(part["inlineData"]["data"])
                    break
        if not image_bytes:
            raise RuntimeError(f"No image bytes returned in response: {res.text}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(image_bytes)
    print(f" Saved: {output_path} ({len(image_bytes) // 1024} KB)")


def main():
    parser = argparse.ArgumentParser(description="Generate Kwagi mascot assets with Gemini API")
    parser.add_argument("--api-key", help="Gemini API Key (or set GEMINI_API_KEY env)")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"Model to use (default: {DEFAULT_MODEL})")
    parser.add_argument("--pro", action="store_true", help="Use Nano Banana Pro (gemini-3-pro-image-preview)")
    parser.add_argument("--poses", action="store_true", help="Generate the 3 reference poses into assets/mascot/reference/")
    parser.add_argument("--sheets", action="store_true", help="Generate directions and reactions sheets into characters/kwagi/")
    parser.add_argument("--all", action="store_true", help="Generate both reference poses and sprite sheets")
    args = parser.parse_args()

    api_key = get_api_key(args.api_key)
    if not api_key:
        print("ERROR: GEMINI_API_KEY is not set.")
        print("Provide via --api-key <KEY> or export GEMINI_API_KEY='<KEY>'")
        sys.exit(1)

    model = PRO_MODEL if args.pro else args.model

    # Initialize client if google-genai is present
    client = None
    if genai is not None:
        try:
            client = genai.Client(api_key=api_key)
        except Exception:
            client = None

    def generate(prompt, out_path, ref=None):
        if client:
            generate_image_genai(client, api_key, prompt, out_path, model=model, reference_image=ref)
        else:
            generate_image_rest(api_key, prompt, out_path, model=model, reference_image=ref)

    if args.poses or args.all or (not args.sheets and not args.poses and not args.all):
        print("\n--- Generating 3 Reference Poses (MASCOT.md) ---")
        REFERENCE_DIR.mkdir(parents=True, exist_ok=True)
        for pose, prompt in KWAGI_PROMPTS.items():
            out_file = REFERENCE_DIR / f"kwagi-{pose}-gemini.jpg"
            print(f"\n[Pose: {pose}] -> {out_file.name}")
            generate(prompt, out_file)

    if args.sheets or args.all:
        print("\n--- Generating page-mascot 3x3 Sprite Sheets ---")
        CHARACTERS_DIR.mkdir(parents=True, exist_ok=True)
        dir_file = CHARACTERS_DIR / "directions.png"
        react_file = CHARACTERS_DIR / "reactions.png"

        print(f"\n[Sheet: Directions (9 Head Turns)] -> {dir_file.name}")
        generate(DIRECTIONS_PROMPT, dir_file)

        print(f"\n[Sheet: Reactions (9 Expressions)] -> {react_file.name}")
        generate(REACTIONS_PROMPT, react_file, ref=str(dir_file))


if __name__ == "__main__":
    main()
