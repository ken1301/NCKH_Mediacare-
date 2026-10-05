import json
import sys
import unicodedata
from pathlib import Path

import cv2
from rapidfuzz.distance import Levenshtein

ROOT = Path(__file__).resolve().parents[1]
PADDLE_SRC = ROOT / "runtime/PaddleOCR-src"
sys.path.insert(0, str(PADDLE_SRC))
from tools.infer import utility  # noqa: E402
from tools.infer.predict_rec import TextRecognizer  # noqa: E402


def norm(text, strip=False):
    value = " ".join(str(text or "").replace("\r", " ").split()).lower()
    if strip:
        value = "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn")
    return value


def main():
    split = sys.argv[1] if len(sys.argv) > 1 else "validation"
    manifest = ROOT / f"dataset/processed/vaipe-ocr-crops/paddleocr/rec_gt_{split}.txt"
    image_root = ROOT / "dataset/processed/vaipe-ocr-crops"
    model_dir = ROOT / "dataset/processed/vaipe-ocr-crops/paddleocr/fine-tune/inference"
    rows = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        image, text = line.split("\t", 1)
        rows.append((image_root / image, text))

    sys.argv = [
        "predict_rec.py", "--rec_model_dir", str(model_dir), "--use_gpu", "True",
        "--rec_batch_num", "64", "--show_log", "False", "--rec_image_shape", "3,48,320",
    ]
    args = utility.parse_args()
    recognizer = TextRecognizer(args)
    totals = {"char_errors": 0, "chars": 0, "word_errors": 0, "words": 0, "exact": 0}
    plain = {key: 0 for key in totals}
    batch_size = 64
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        images, valid = [], []
        for image_path, text in batch:
            image = cv2.imread(str(image_path))
            if image is not None:
                images.append(image)
                valid.append(text)
        predictions, _ = recognizer(images)
        for reference, prediction in zip(valid, predictions):
            hypothesis = prediction[0] if isinstance(prediction, (list, tuple)) else str(prediction)
            for target, remove_diacritics in ((totals, False), (plain, True)):
                ref = norm(reference, remove_diacritics)
                hyp = norm(hypothesis, remove_diacritics)
                ref_words, hyp_words = ref.split(), hyp.split()
                target["char_errors"] += Levenshtein.distance(ref, hyp)
                target["chars"] += len(ref)
                target["word_errors"] += Levenshtein.distance(ref_words, hyp_words)
                target["words"] += len(ref_words)
                target["exact"] += int(ref == hyp)
        if (start // batch_size + 1) % 10 == 0 or start + batch_size >= len(rows):
            print(f"processed {min(start + batch_size, len(rows))}/{len(rows)}", flush=True)

    result = {
        "split": split, "samples": len(rows),
        "cer": totals["char_errors"] / totals["chars"],
        "wer": totals["word_errors"] / totals["words"],
        "exact_match": totals["exact"] / len(rows),
        "cer_without_diacritics": plain["char_errors"] / plain["chars"],
        "wer_without_diacritics": plain["word_errors"] / plain["words"],
        "exact_match_without_diacritics": plain["exact"] / len(rows),
    }
    output = ROOT / f"dataset/processed/vaipe-text-finetuned/recognition-crops-{split}-evaluation.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
