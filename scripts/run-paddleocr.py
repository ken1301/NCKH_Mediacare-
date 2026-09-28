"""Run local PaddleOCR and emit the prediction contract used by the JS evaluator."""

import argparse
import json
import os
from pathlib import Path

# Keep model/cache writes inside the workspace runtime rather than the user's profile.
os.environ.setdefault("FLAGS_enable_pir_api", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")

from paddleocr import PaddleOCR


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, help="Baseline manifest JSON, e.g. test.json")
    parser.add_argument("--input", default="dataset/external/vaipe-p")
    parser.add_argument("--output", required=True, help="Prediction JSON output")
    parser.add_argument("--lang", default="vi")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--model", choices=("mobile", "medium"), default="mobile")
    parser.add_argument("--limit", type=int, default=0, help="Only process first N samples for a smoke test")
    return parser.parse_args()


def result_to_dict(page):
    if isinstance(page, dict):
        return page
    for attribute in ("json", "to_dict"):
        value = getattr(page, attribute, None)
        if callable(value):
            value = value()
        if isinstance(value, str):
            return json.loads(value)
        if isinstance(value, dict):
            return value
    raise TypeError(f"Unsupported PaddleOCR result type: {type(page)!r}")


def to_box(value):
    if value is None:
        return None
    points = value.tolist() if hasattr(value, "tolist") else value
    if isinstance(points, list) and len(points) >= 4 and isinstance(points[0], (list, tuple)):
        xs = [float(point[0]) for point in points]
        ys = [float(point[1]) for point in points]
        return [min(xs), min(ys), max(xs), max(ys)]
    if isinstance(points, list) and len(points) >= 4:
        return [float(number) for number in points[:4]]
    return None


def predict_one(ocr, image_path):
    results = ocr.predict(str(image_path))
    words = []
    for page in results:
        data = result_to_dict(page)
        texts = data.get("rec_texts", [])
        boxes = data.get("rec_boxes", data.get("dt_polys", []))
        scores = data.get("rec_scores", [])
        for index, text in enumerate(texts):
            box = to_box(boxes[index]) if index < len(boxes) else None
            if box is None:
                continue
            score = float(scores[index]) if index < len(scores) else None
            words.append({"text": str(text), "bbox": box, "confidence": score})
    return words


def main():
    args = parse_args()
    input_root = Path(args.input).resolve()
    manifest_path = Path(args.manifest).resolve()
    output_path = Path(args.output).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    samples = manifest[: args.limit] if args.limit > 0 else manifest
    model_options = {}
    if args.model == "mobile":
        model_options = {
            "text_detection_model_name": "PP-OCRv5_mobile_det",
            "text_recognition_model_name": "latin_PP-OCRv5_mobile_rec",
        }
    ocr = PaddleOCR(
        lang=args.lang,
        device=args.device,
        enable_mkldnn=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        **model_options,
    )
    predictions = []
    for index, sample in enumerate(samples, start=1):
        image_path = input_root / sample["image"]
        try:
            words = predict_one(ocr, image_path)
            predictions.append({"sample_id": sample["sample_id"], "ocr": words, "entities": []})
            print(f"[{index}/{len(samples)}] {sample['sample_id']}: {len(words)} words", flush=True)
        except Exception as error:
            predictions.append({"sample_id": sample["sample_id"], "ocr": [], "entities": [], "error": str(error)})
            print(f"[{index}/{len(samples)}] {sample['sample_id']}: ERROR {error}", flush=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(predictions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(predictions)} predictions to {output_path}")


if __name__ == "__main__":
    main()
