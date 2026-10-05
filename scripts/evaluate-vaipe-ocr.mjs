import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gt = JSON.parse(await fs.readFile(path.join(root, "dataset", "processed", "vaipe-text-groundtruth", "all.json"), "utf8"));
const pred = JSON.parse(await fs.readFile(path.join(root, "dataset", "processed", "vaipe-text-finetuned", "all.json"), "utf8"));

function normalize(text, removeDiacritics = false) {
  let value = String(text ?? "").normalize("NFC").replace(/\r/g, " ").replace(/\n+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return removeDiacritics ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : value;
}

function distance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

function score(ref, hyp, strip = false) {
  const reference = normalize(ref, strip);
  const hypothesis = normalize(hyp, strip);
  const refWords = reference ? reference.split(" ") : [];
  const hypWords = hypothesis ? hypothesis.split(" ") : [];
  return {
    charErrors: distance(reference, hypothesis),
    chars: reference.length,
    wordErrors: distance(refWords, hypWords),
    words: refWords.length,
    exact: reference === hypothesis ? 1 : 0,
  };
}

function add(a, b) {
  for (const key of Object.keys(a)) a[key] += b[key];
}

const predById = new Map(pred.map((row) => [row.sample_id, row]));
const overall = { charErrors: 0, chars: 0, wordErrors: 0, words: 0, exact: 0 };
const noDiacritics = { charErrors: 0, chars: 0, wordErrors: 0, words: 0, exact: 0 };
const rows = [];
for (const reference of gt) {
  const hypothesis = predById.get(reference.sample_id)?.text ?? "";
  const raw = score(reference.text, hypothesis);
  const plain = score(reference.text, hypothesis, true);
  add(overall, raw); add(noDiacritics, plain);
  rows.push({ sample_id: reference.sample_id, cer: raw.chars ? raw.charErrors / raw.chars : 0, wer: raw.words ? raw.wordErrors / raw.words : 0, exact: raw.exact });
}

const result = {
  samples: rows.length,
  cer: overall.chars ? overall.charErrors / overall.chars : 0,
  wer: overall.words ? overall.wordErrors / overall.words : 0,
  exact_match: overall.exact / rows.length,
  cer_without_diacritics: noDiacritics.chars ? noDiacritics.charErrors / noDiacritics.chars : 0,
  wer_without_diacritics: noDiacritics.words ? noDiacritics.wordErrors / noDiacritics.words : 0,
  exact_match_without_diacritics: noDiacritics.exact / rows.length,
  worst_samples: rows.sort((a, b) => b.cer - a.cer).slice(0, 20),
};
const output = path.join(root, "dataset", "processed", "vaipe-text-finetuned", "evaluation.json");
await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ samples: result.samples, CER: result.cer, WER: result.wer, exact: result.exact_match, CER_without_diacritics: result.cer_without_diacritics, output }));
