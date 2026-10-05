"""Image -> OCR word boxes -> ordered text output for Vietnamese prescriptions."""

import argparse
import json
import os
from pathlib import Path

os.environ.setdefault("FLAGS_enable_pir_api", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")

from paddleocr import PaddleOCR


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Image file or directory")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--rec-model-dir", default="", help="Custom PaddleOCR recognition inference model directory")
    return parser.parse_args()


def result_to_dict(page):
    if isinstance(page, dict):
        return page
    value = getattr(page, "json", None)
    if callable(value):
        value = value()
    if isinstance(value, str):
        return json.loads(value)
    if isinstance(value, dict):
        return value
    raise TypeError(f"Unsupported PaddleOCR result type: {type(page)!r}")


def to_box(value):
    points = value.tolist() if hasattr(value, "tolist") else value
    if isinstance(points, list) and len(points) >= 4 and isinstance(points[0], (list, tuple)):
        xs = [float(point[0]) for point in points]
        ys = [float(point[1]) for point in points]
        return [min(xs), min(ys), max(xs), max(ys)]
    return [float(number) for number in points[:4]] if isinstance(points, list) else None


def collect_words(ocr, image_path):
    words = []
    for page in ocr.predict(str(image_path)):
        data = result_to_dict(page)
        texts = data.get("rec_texts", [])
        boxes = data.get("rec_boxes", data.get("dt_polys", []))
        scores = data.get("rec_scores", [])
        for index, text in enumerate(texts):
            box = to_box(boxes[index]) if index < len(boxes) else None
            if not box or not str(text).strip():
                continue
            words.append({
                "text": str(text).strip(),
                "bbox": box,
                "confidence": float(scores[index]) if index < len(scores) else None,
            })
    return words


def group_lines(words):
    prepared = []
    for word in words:
        x1, y1, x2, y2 = word["bbox"]
        prepared.append({**word, "center_y": (y1 + y2) / 2, "height": max(1, y2 - y1)})
    prepared.sort(key=lambda word: (word["center_y"], word["bbox"][0]))
    lines = []
    for word in prepared:
        line = lines[-1] if lines else None
        tolerance = max(10, min(30, word["height"] * 0.65))
        if line is None or abs(word["center_y"] - line["center_y"]) > tolerance:
            line = {"center_y": word["center_y"], "words": []}
            lines.append(line)
        line["words"].append(word)
        line["center_y"] = sum(item["center_y"] for item in line["words"]) / len(line["words"])

    result = []
    for line in lines:
        line["words"].sort(key=lambda word: word["bbox"][0])
        result.append({
            "text": " ".join(word["text"] for word in line["words"]),
            "bbox": [
                min(word["bbox"][0] for word in line["words"]),
                min(word["bbox"][1] for word in line["words"]),
                max(word["bbox"][2] for word in line["words"]),
                max(word["bbox"][3] for word in line["words"]),
            ],
            "words": [
                {key: word[key] for key in ("text", "bbox", "confidence")}
                for word in line["words"]
            ],
        })
    return result


def main():
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    images = [input_path] if input_path.is_file() else sorted(
        path for path in input_path.rglob("*") if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    model_options = {}
    if args.rec_model_dir:
        model_options["text_recognition_model_dir"] = str(Path(args.rec_model_dir).resolve())
    ocr = PaddleOCR(
        device=args.device,
        enable_mkldnn=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
        **model_options,
    )
    all_results = []
    for image_path in images:
        words = collect_words(ocr, image_path)
        lines = group_lines(words)
        result = {
            "sample_id": image_path.stem,
            "image": str(image_path),
            "text": "\n".join(line["text"] for line in lines),
            "lines": lines,
        }
        all_results.append(result)
        (output_dir / f"{image_path.stem}.txt").write_text(result["text"] + "\n", encoding="utf-8")
        (output_dir / f"{image_path.stem}.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{image_path.name}: {len(words)} words, {len(lines)} lines", flush=True)
    (output_dir / "all.json").write_text(json.dumps(all_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"images": len(all_results), "output": str(output_dir)}))


if __name__ == "__main__":
    main()
