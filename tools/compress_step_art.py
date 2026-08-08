#!/usr/bin/env python3
import sys
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parent.parent
STEPS = REPO / "assets" / "steps"
TARGET = 640
QUALITY = 82


def compress(master_path, out_path):
    with Image.open(master_path) as im:
        resized = im.convert("RGBA").resize((TARGET, TARGET), Image.LANCZOS)
        resized.save(out_path, format="WEBP", quality=QUALITY, alpha_quality=92, method=6)
    return out_path.stat().st_size


def main():
    masters = sorted(STEPS.glob("*.png"))
    if not masters:
        print(f"no masters in {STEPS}", file=sys.stderr)
        return 1
    total = 0
    for master in masters:
        out_path = master.with_suffix(".webp")
        size = compress(master, out_path)
        total += size
        print(f"{out_path.name}  {size / 1000:.0f} kB")
    print(f"wrote {len(masters)} images, {total / 1_000_000:.2f} MB total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
