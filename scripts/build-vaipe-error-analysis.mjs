import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { boxIoU, normalizeOcrText } from '../src/dataset/baseline-metrics.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function numericSignature(text) {
  return (String(text ?? '').match(/\d+(?:[.,]\d+)?/g) ?? []).map((value) => value.replace(',', '.'));
}

function matchBoxes(goldWords, predictedWords, threshold = 0.5) {
  const candidates = [];
  for (let goldIndex = 0; goldIndex < goldWords.length; goldIndex += 1) {
    for (let predictedIndex = 0; predictedIndex < predictedWords.length; predictedIndex += 1) {
      const iou = boxIoU(goldWords[goldIndex].box, predictedWords[predictedIndex].bbox);
      if (iou >= threshold) candidates.push({ goldIndex, predictedIndex, iou });
    }
  }
  candidates.sort((left, right) => right.iou - left.iou);
  const usedGold = new Set();
  const usedPredicted = new Set();
  return candidates.filter((candidate) => {
    if (usedGold.has(candidate.goldIndex) || usedPredicted.has(candidate.predictedIndex)) return false;
    usedGold.add(candidate.goldIndex);
    usedPredicted.add(candidate.predictedIndex);
    return true;
  });
}

function bucket(value, boundaries) {
  if (value < boundaries[0]) return `lt_${String(boundaries[0]).replace('.', '_')}`;
  if (value < boundaries[1]) return `${String(boundaries[0]).replace('.', '_')}_to_${String(boundaries[1]).replace('.', '_')}`;
  return `gte_${String(boundaries[1]).replace('.', '_')}`;
}

const metadataDir = path.resolve(option('--metadata', 'dataset/metadata/vaipe-p-baseline'));
const inputDir = path.resolve(option('--input', 'dataset/external/vaipe-p'));
const output = path.resolve(option('--output', 'dataset/metadata/vaipe-p-baseline/error-analysis.json'));
const manifest = JSON.parse(await readFile(path.join(metadataDir, 'test.json'), 'utf8'));
const predictions = JSON.parse(await readFile(path.join(metadataDir, 'predictions-test.json'), 'utf8'));
const p0 = JSON.parse(await readFile(path.join(metadataDir, 'evaluation-p0.json'), 'utf8'));
const p1 = JSON.parse(await readFile(path.join(metadataDir, 'evaluation-p1-linking.json'), 'utf8'));
const predictionById = new Map(predictions.map((item) => [item.sample_id, item]));
const p0ById = new Map(p0.per_sample.map((item) => [item.sample_id, item]));
const p1ById = new Map(p1.per_sample.map((item) => [item.sample_id, item]));

const perSample = [];
const totals = {
  numeric_gold_boxes: 0,
  numeric_matched_boxes: 0,
  numeric_exact_matches: 0,
  numeric_disagreements: 0,
  numeric_unmatched_gold_boxes: 0,
  over_detection_samples: 0,
  under_detection_samples: 0
};

for (const item of manifest) {
  const annotationPath = path.join(inputDir, item.annotation.replaceAll('\\', path.sep));
  const goldWords = JSON.parse(await readFile(annotationPath, 'utf8'))
    .filter((word) => Array.isArray(word.box) && typeof word.text === 'string');
  const predictedWords = predictionById.get(item.sample_id)?.ocr ?? [];
  const matches = matchBoxes(goldWords, predictedWords);
  const matchedByGold = new Map(matches.map((match) => [match.goldIndex, match]));
  let numericGoldBoxes = 0;
  let numericMatchedBoxes = 0;
  let numericExactMatches = 0;
  let numericDisagreements = 0;
  let numericUnmatchedGoldBoxes = 0;

  for (let goldIndex = 0; goldIndex < goldWords.length; goldIndex += 1) {
    const goldNumbers = numericSignature(goldWords[goldIndex].text);
    if (goldNumbers.length === 0) continue;
    numericGoldBoxes += 1;
    const match = matchedByGold.get(goldIndex);
    if (!match) {
      numericUnmatchedGoldBoxes += 1;
      continue;
    }
    numericMatchedBoxes += 1;
    const predictedNumbers = numericSignature(predictedWords[match.predictedIndex].text);
    if (JSON.stringify(goldNumbers) === JSON.stringify(predictedNumbers)) numericExactMatches += 1;
    else numericDisagreements += 1;
  }

  const ocr = p0ById.get(item.sample_id)?.ocr ?? {};
  const linking = p1ById.get(item.sample_id) ?? {};
  const goldCount = Number(ocr.gold_count ?? item.word_box_count ?? 0);
  const predictedCount = Number(ocr.predicted_count ?? predictedWords.length);
  if (predictedCount > goldCount) totals.over_detection_samples += 1;
  if (predictedCount < goldCount) totals.under_detection_samples += 1;
  totals.numeric_gold_boxes += numericGoldBoxes;
  totals.numeric_matched_boxes += numericMatchedBoxes;
  totals.numeric_exact_matches += numericExactMatches;
  totals.numeric_disagreements += numericDisagreements;
  totals.numeric_unmatched_gold_boxes += numericUnmatchedGoldBoxes;

  perSample.push({
    sample_id: item.sample_id,
    ocr_f1: ocr.f1 ?? null,
    cer: ocr.mean_cer ?? null,
    wer: ocr.mean_wer ?? null,
    gold_word_boxes: goldCount,
    predicted_word_boxes: predictedCount,
    link_gold_drugs: linking.gold_drug_count ?? item.drug_count ?? null,
    link_correct: linking.correct_links ?? 0,
    link_candidate_lines: linking.candidate_links ?? 0,
    link_recall: linking.gold_drug_count ? (linking.correct_links ?? 0) / linking.gold_drug_count : null,
    numeric_gold_boxes: numericGoldBoxes,
    numeric_disagreements: numericDisagreements,
    numeric_unmatched_gold_boxes: numericUnmatchedGoldBoxes
  });
}

const report = {
  generated_at: new Date().toISOString(),
  status: 'diagnostic_only',
  metric_scope: 'P0 OCR + P1 exploratory drug linking; no medication NER/relation metric',
  thresholds: {
    box_iou: 0.5,
    ocr_f1_buckets: '<0.60, 0.60-0.80, >=0.80',
    numeric_check: 'digit sequence comparison after box IoU matching; not a clinical critical error rate'
  },
  totals: {
    samples: perSample.length,
    ...totals,
    numeric_exact_rate_on_matched_numeric_boxes: totals.numeric_matched_boxes === 0
      ? null
      : totals.numeric_exact_matches / totals.numeric_matched_boxes
  },
  distributions: {
    ocr_f1: Object.fromEntries(['lt_0_6', '0_6_to_0_8', 'gte_0_8'].map((key) => [key, perSample.filter((item) => bucket(item.ocr_f1 ?? 0, [0.6, 0.8]) === key).length])),
    link_recall: Object.fromEntries(['lt_0_5', '0_5_to_0_9', 'gte_0_9'].map((key) => [key, perSample.filter((item) => item.link_recall !== null && bucket(item.link_recall, [0.5, 0.9]) === key).length])),
    numeric_issue_samples: perSample.filter((item) => item.numeric_disagreements > 0 || item.numeric_unmatched_gold_boxes > 0).length
  },
  observations: [
    'P1 linking is exploratory because the catalog is train-derived and not a trusted drug database.',
    'Numeric disagreement is an OCR diagnostic proxy only; it must not be reported as clinically critical error rate.',
    'Medication NER and relation extraction remain blocked until complete reviewed annotations are available.'
  ],
  worst_ocr_samples: [...perSample].sort((left, right) => (left.ocr_f1 ?? 0) - (right.ocr_f1 ?? 0)).slice(0, 20),
  worst_linking_samples: [...perSample].filter((item) => item.link_recall !== null).sort((left, right) => (left.link_recall ?? 0) - (right.link_recall ?? 0)).slice(0, 20)
};

await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Analyzed ${report.totals.samples} samples.`);
console.log(`Numeric disagreements: ${report.totals.numeric_disagreements}; unmatched numeric boxes: ${report.totals.numeric_unmatched_gold_boxes}.`);
console.log(`Report: ${output}`);
