"""Create OCR crops and manifests from existing VAIPE word-box annotations."""

import argparse
import json
from pathlib import Path

from PIL import Image


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="dataset/processed/vaipe-text")
    parser.add_argument("--images", default="dataset/external/vaipe-p")
    parser.add_argument("--output", default="dataset/processed/vaipe-ocr-crops")
    parser.add_argument("--padding", type=int, default=4)
    return parser.parse_args()


def clamp_box(box, width, height, padding):
    x1, y1, x2, y2 = [int(round(float(value))) for value in box]
    return [
        max(0, x1 - padding),
        max(0, y1 - padding),
        min(width, x2 + padding),
        min(height, y2 + padding),
    ]


def main():
    args = parse_args()
    input_dir = Path(args.input).resolve()
    image_root = Path(args.images).resolve()
    output_dir = Path(args.output).resolve()
    total = 0

    for split in ("train", "validation", "test"):
        source_manifest = input_dir / f"{split}.jsonl"
        split_dir = output_dir / split
        split_dir.mkdir(parents=True, exist_ok=True)
        rows = []
        for line in source_manifest.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            document = json.loads(line)
            image_path = image_root / document["image"]
            with Image.open(image_path) as image:
                rgb = image.convert("RGB")
                width, height = rgb.size
                for index, word in enumerate(document.get("words", [])):
                    text = str(word.get("text", "")).strip()
                    if not text or len(word.get("bbox", [])) != 4:
                        continue
                    crop_box = clamp_box(word["bbox"], width, height, args.padding)
                    if crop_box[2] <= crop_box[0] or crop_box[3] <= crop_box[1]:
                        continue
                    crop_name = f"{document['sample_id']}_{index:04d}.png"
                    crop_path = split_dir / crop_name
                    rgb.crop(tuple(crop_box)).save(crop_path)
                    rows.append({
                        "image": str(crop_path.relative_to(output_dir)).replace("\\", "/"),
                        "text": text,
                        "label": word.get("label", "other"),
                        "source_sample_id": document["sample_id"],
                        "source_bbox": word["bbox"],
                        "crop_bbox": crop_box,
                    })
                    total += 1
        (output_dir / f"{split}.jsonl").write_text(
            "\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n",
            encoding="utf-8",
        )
        (output_dir / f"{split}.json").write_text(
            json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"{split}: {len(rows)} crops", flush=True)

    (output_dir / "summary.json").write_text(
        json.dumps({"total_crops": total, "padding": args.padding}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"total_crops": total, "output": str(output_dir)}))


if __name__ == "__main__":
    main()
