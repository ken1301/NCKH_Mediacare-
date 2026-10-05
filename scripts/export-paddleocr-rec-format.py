"""Export VAIPE OCR crop manifests to PaddleOCR recognition format."""

import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="dataset/processed/vaipe-ocr-crops")
    parser.add_argument("--output", default="dataset/processed/vaipe-ocr-crops/paddleocr")
    args = parser.parse_args()

    input_dir = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    summary = {}

    for split in ("train", "validation", "test"):
        source = input_dir / f"{split}.jsonl"
        target = output_dir / f"rec_gt_{split}.txt"
        rows = []
        for line in source.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            item = json.loads(line)
            text = " ".join(str(item["text"]).split())
            if not text:
                continue
            image_path = Path(item["image"])
            rows.append(f"{image_path.as_posix()}\t{text}")
        target.write_text("\n".join(rows) + "\n", encoding="utf-8")
        summary[split] = len(rows)

    (output_dir / "README.md").write_text(
        "# PaddleOCR recognition manifests\n\n"
        "Mỗi dòng có dạng `relative_image_path<TAB>text`.\n\n"
        "Chạy training với working directory là thư mục crop dataset để các đường dẫn `train/...` được resolve đúng.\n",
        encoding="utf-8",
    )
    (output_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output_dir), **summary}))


if __name__ == "__main__":
    main()
