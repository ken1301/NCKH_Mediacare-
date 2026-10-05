import json
import re
import unicodedata
from pathlib import Path

from rapidfuzz.distance import Levenshtein

ROOT = Path(__file__).resolve().parents[1]
GT_PATH = ROOT / "dataset/processed/vaipe-text-groundtruth/all.json"
PRED_PATH = ROOT / "dataset/processed/vaipe-text-finetuned/all.json"
OUT_PATH = ROOT / "dataset/processed/vaipe-text-finetuned/evaluation.json"


def normalize(text, remove_diacritics=False):
    value = " ".join(str(text or "").replace("\r", " ").split()).lower()
    if remove_diacritics:
        value = "".join(c for c in unicodedata.normalize("NFD", value) if unicodedata.category(c) != "Mn")
    return value


def score(reference, hypothesis, remove_diacritics=False):
    ref = normalize(reference, remove_diacritics)
    hyp = normalize(hypothesis, remove_diacritics)
    ref_words = ref.split()
    hyp_words = hyp.split()
    return {
        "char_errors": Levenshtein.distance(ref, hyp),
        "chars": len(ref),
        "word_errors": Levenshtein.distance(ref_words, hyp_words),
        "words": len(ref_words),
        "exact": int(ref == hyp),
    }


def add(target, values):
    for key in target:
        target[key] += values[key]


ground_truth = json.loads(GT_PATH.read_text(encoding="utf-8"))
predictions = json.loads(PRED_PATH.read_text(encoding="utf-8"))
by_id = {row["sample_id"]: row for row in predictions}
overall = {key: 0 for key in ("char_errors", "chars", "word_errors", "words", "exact")}
plain = {key: 0 for key in ("char_errors", "chars", "word_errors", "words", "exact")}
per_sample = []

for row in ground_truth:
    hypothesis = by_id.get(row["sample_id"], {}).get("text", "")
    raw = score(row["text"], hypothesis)
    no_diacritics = score(row["text"], hypothesis, True)
    add(overall, raw)
    add(plain, no_diacritics)
    per_sample.append({
        "sample_id": row["sample_id"],
        "cer": raw["char_errors"] / raw["chars"] if raw["chars"] else 0,
        "wer": raw["word_errors"] / raw["words"] if raw["words"] else 0,
        "exact": raw["exact"],
    })

result = {
    "samples": len(ground_truth),
    "cer": overall["char_errors"] / overall["chars"],
    "wer": overall["word_errors"] / overall["words"],
    "exact_match": overall["exact"] / len(ground_truth),
    "cer_without_diacritics": plain["char_errors"] / plain["chars"],
    "wer_without_diacritics": plain["word_errors"] / plain["words"],
    "exact_match_without_diacritics": plain["exact"] / len(ground_truth),
    "worst_samples": sorted(per_sample, key=lambda item: item["cer"], reverse=True)[:20],
}
OUT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"samples": result["samples"], "CER": result["cer"], "WER": result["wer"], "exact": result["exact_match"], "CER_without_diacritics": result["cer_without_diacritics"], "output": str(OUT_PATH)}, ensure_ascii=False))
