"""Image -> OCR word boxes -> ordered text output for Vietnamese prescriptions."""

import argparse
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("FLAGS_enable_pir_api", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(ROOT / "runtime/paddlex-cache"))

from paddleocr import PaddleOCR

MOJIBAKE_MARKERS = ("Ã", "Â", "áº", "á»", "Ä", "Æ", "Å", "�")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Image file or directory")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--rec-model-dir", default="", help="Custom PaddleOCR recognition inference model directory")
    return parser.parse_args()


def mojibake_score(text):
    return sum(str(text).count(marker) for marker in MOJIBAKE_MARKERS)


def repair_mojibake(text):
    value = str(text)
    best = value
    best_score = mojibake_score(value)
    for encoding in ("cp1252", "latin1"):
        try:
            candidate = value.encode(encoding).decode("utf-8")
        except UnicodeError:
            continue
        score = mojibake_score(candidate)
        if score < best_score:
            best = candidate
            best_score = score
    return best


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
                "text": repair_mojibake(str(text).strip()),
                "bbox": box,
                "confidence": float(scores[index]) if index < len(scores) else None,
            })
    return words


def group_lines(words):
    prepared = []
    for word in words:
        x1, y1, x2, y2 = word["bbox"]
        prepared.append({
            **word,
            "center_y": (y1 + y2) / 2,
            "height": max(1, y2 - y1),
        })
    prepared.sort(key=lambda word: (word["center_y"], word["bbox"][0]))
    lines = []
    for word in prepared:
        wx1, wy1, wx2, wy2 = word["bbox"]
        best_line = None
        best_score = -1
        for line in lines:
            lx1, ly1, lx2, ly2 = line["bbox"]
            overlap = max(0, min(wy2, ly2) - max(wy1, ly1))
            overlap_ratio = overlap / max(1, min(word["height"], line["height"]))
            center_distance = abs(word["center_y"] - line["center_y"])
            center_tolerance = max(8, min(28, min(word["height"], line["height"]) * 0.55))
            close_center = center_distance <= center_tolerance
            strong_overlap = overlap_ratio >= 0.55 and center_distance <= max(center_tolerance, line["height"] * 0.45)
            if close_center or strong_overlap:
                score = overlap_ratio - (center_distance / max(1, line["height"])) * 0.1
                if score > best_score:
                    best_score = score
                    best_line = line
        line = best_line
        if line is None:
            line = {"bbox": [wx1, wy1, wx2, wy2], "center_y": word["center_y"], "height": word["height"], "words": []}
            lines.append(line)
        line["words"].append(word)
        line["bbox"] = [
            min(item["bbox"][0] for item in line["words"]),
            min(item["bbox"][1] for item in line["words"]),
            max(item["bbox"][2] for item in line["words"]),
            max(item["bbox"][3] for item in line["words"]),
        ]
        line["center_y"] = (line["bbox"][1] + line["bbox"][3]) / 2
        line["height"] = max(1, line["bbox"][3] - line["bbox"][1])

    result = []
    for line in sorted(lines, key=lambda line: (line["bbox"][1], line["bbox"][0])):
        line["words"].sort(key=lambda word: word["bbox"][0])
        result.append({
            "text": " ".join(word["text"] for word in line["words"]),
            "bbox": line["bbox"],
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
