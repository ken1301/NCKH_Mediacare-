import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractDrugNameAndStrength, linkDrug, normalizeDrugText } from '../src/catalog/drug-catalog.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function centerY(box) {
  return (Number(box?.[1] ?? 0) + Number(box?.[3] ?? 0)) / 2;
}

function boxHeight(box) {
  return Math.max(1, Number(box?.[3] ?? 0) - Number(box?.[1] ?? 0));
}

function groupOcrLines(words) {
  const lines = [];
  for (const word of [...words].filter((item) => item.text && item.bbox).sort((left, right) => centerY(left.bbox) - centerY(right.bbox) || left.bbox[0] - right.bbox[0])) {
    const matchingLine = lines.find((line) => Math.abs(centerY(word.bbox) - line.center_y) <= Math.max(boxHeight(word.bbox), line.height) * 0.55);
    if (matchingLine) {
      matchingLine.words.push(word);
      matchingLine.center_y = matchingLine.words.reduce((sum, item) => sum + centerY(item.bbox), 0) / matchingLine.words.length;
      matchingLine.height = Math.max(matchingLine.height, boxHeight(word.bbox));
    } else {
      lines.push({ words: [word], center_y: centerY(word.bbox), height: boxHeight(word.bbox) });
    }
  }
  return lines.map((line) => {
    const wordsInLine = line.words.sort((left, right) => left.bbox[0] - right.bbox[0]);
    return {
      text: wordsInLine.map((word) => word.text).join(' '),
      bbox: [
        Math.min(...wordsInLine.map((word) => word.bbox[0])),
        Math.min(...wordsInLine.map((word) => word.bbox[1])),
        Math.max(...wordsInLine.map((word) => word.bbox[2])),
        Math.max(...wordsInLine.map((word) => word.bbox[3]))
      ]
    };
  });
}

function catalogFromCandidates(candidateReport) {
  return candidateReport.candidates.map((candidate) => ({
    drug_database_id: candidate.candidate_id,
    brand_name: candidate.brand_name,
    aliases: candidate.raw_texts,
    strengths: candidate.strengths
  }));
}

const input = option('--input', 'dataset/external/vaipe-p');
const manifestPath = option('--manifest', 'dataset/metadata/vaipe-p-baseline/test.json');
const candidatePath = option('--candidates', 'dataset/metadata/vaipe-p-baseline/drug-candidates.json');
const predictionsPath = option('--predictions', 'dataset/metadata/vaipe-p-baseline/predictions-test.json');
const output = option('--output', 'dataset/metadata/vaipe-p-baseline/evaluation-p1-linking.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const candidates = catalogFromCandidates(JSON.parse(await readFile(candidatePath, 'utf8')));
const predictions = JSON.parse(await readFile(predictionsPath, 'utf8'));
const predictionMap = new Map(predictions.map((item) => [item.sample_id, item]));
const perSample = [];
let goldCount = 0;
let linkedCount = 0;
let correctCount = 0;
let needsReviewCount = 0;
let notFoundCount = 0;

for (const sample of manifest) {
  const annotation = JSON.parse(await readFile(path.resolve(input, sample.annotation), 'utf8'));
  const goldDrugs = annotation.filter((item) => item.label === 'drugname').map((item) => extractDrugNameAndStrength(item.text));
  const predictedLines = groupOcrLines(predictionMap.get(sample.sample_id)?.ocr ?? []);
  const links = predictedLines.map((line) => {
    const parsed = extractDrugNameAndStrength(line.text);
    const result = linkDrug({ drug_name: parsed.drug_name, strength: parsed.strengths[0], raw_text: line.text }, candidates, { threshold: 0.78, ambiguity_margin: 0.04 });
    return { text: line.text, parsed, result };
  }).filter((item) => item.result.status !== 'not_found' || item.result.candidates.length > 0);
  const matchedGold = new Set();
  let sampleCorrect = 0;
  for (const link of links) {
    const normalizedLinked = normalizeDrugText(link.result.normalized_name ?? link.result.candidates?.[0]?.brand_name ?? '');
    const goldIndex = goldDrugs.findIndex((gold, index) => !matchedGold.has(index) && normalizeDrugText(gold.drug_name) === normalizedLinked);
    if (link.result.status === 'linked') {
      linkedCount += 1;
      if (goldIndex >= 0) {
        matchedGold.add(goldIndex);
        correctCount += 1;
        sampleCorrect += 1;
      }
    } else if (link.result.status === 'needs_review') needsReviewCount += 1;
    else notFoundCount += 1;
  }
  goldCount += goldDrugs.length;
  perSample.push({ sample_id: sample.sample_id, gold_drug_count: goldDrugs.length, predicted_lines: predictedLines.length, candidate_links: links.length, correct_links: sampleCorrect, links });
}

const report = {
  generated_at: new Date().toISOString(),
  status: 'exploratory_candidate_catalog',
  warning: 'Catalog được tạo từ train split của VAIPE-P Kaggle mirror, không phải trusted drug database; không dùng để công bố/production.',
  catalog_size: candidates.length,
  samples: manifest.length,
  gold_drug_count: goldCount,
  linked_count: linkedCount,
  correct_link_count: correctCount,
  needs_review_count: needsReviewCount,
  not_found_count: notFoundCount,
  link_precision_against_gold: linkedCount === 0 ? 0 : correctCount / linkedCount,
  gold_recall: goldCount === 0 ? 0 : correctCount / goldCount,
  per_sample: perSample
};
report.f1_against_gold = report.link_precision_against_gold + report.gold_recall === 0 ? 0 : (2 * report.link_precision_against_gold * report.gold_recall) / (report.link_precision_against_gold + report.gold_recall);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ catalog_size: report.catalog_size, samples: report.samples, linked: report.linked_count, correct: report.correct_link_count, precision: report.link_precision_against_gold, recall: report.gold_recall, f1: report.f1_against_gold }));
