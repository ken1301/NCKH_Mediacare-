import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { evaluateEntities } from '../src/dataset/baseline-metrics.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function entitiesFromWords(words) {
  return words.filter((word) => word.label === 'drugname' || word.label === 'usage').map((word) => ({
    label: word.label === 'drugname' ? 'DRUG' : 'INSTRUCTION',
    text: word.text ?? '',
    bbox: word.box ?? null
  }));
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

const manifestPath = option('--manifest', 'dataset/metadata/vaipe-p-baseline/test.json');
const input = option('--input', 'dataset/external/vaipe-p');
const predictionsPath = option('--predictions', null);
const output = option('--output', 'dataset/metadata/vaipe-p-baseline/evaluation.json');
const manifest = await readJson(manifestPath);
const predictions = predictionsPath ? await readJson(predictionsPath) : null;
const predictionMap = new Map();
if (Array.isArray(predictions)) {
  for (const item of predictions) predictionMap.set(item.sample_id, item.entities ?? item.predictions ?? []);
} else if (predictions && typeof predictions === 'object') {
  for (const [sampleId, item] of Object.entries(predictions)) predictionMap.set(sampleId, item.entities ?? item.predictions ?? item);
}

const perSample = [];
for (const sample of manifest) {
  const goldRaw = await readJson(path.resolve(input, sample.annotation));
  const gold = entitiesFromWords(goldRaw);
  if (!predictionsPath) {
    perSample.push({ sample_id: sample.sample_id, gold_entity_count: gold.length, prediction_status: 'not_provided' });
    continue;
  }
  perSample.push({ sample_id: sample.sample_id, ...evaluateEntities(gold, predictionMap.get(sample.sample_id) ?? []) });
}

const report = {
  generated_at: new Date().toISOString(),
  manifest: path.resolve(manifestPath),
  input: path.resolve(input),
  predictions: predictionsPath ? path.resolve(predictionsPath) : null,
  status: predictionsPath ? 'evaluated' : 'awaiting_predictions',
  metric_definition: {
    labels: ['DRUG', 'INSTRUCTION'],
    box_iou_threshold: 0.5,
    text_normalization: 'lowercase, remove Vietnamese diacritics, collapse non-alphanumeric whitespace'
  },
  samples: perSample.length,
  samples_with_gold: perSample.filter((sample) => sample.gold_entity_count > 0).length,
  per_sample: perSample
};
if (predictionsPath) {
  const totals = perSample.reduce((accumulator, sample) => {
    for (const key of ['gold_count', 'predicted_count', 'matched_count']) accumulator[key] += sample[key];
    return accumulator;
  }, { gold_count: 0, predicted_count: 0, matched_count: 0 });
  totals.precision = totals.predicted_count === 0 ? 0 : totals.matched_count / totals.predicted_count;
  totals.recall = totals.gold_count === 0 ? 0 : totals.matched_count / totals.gold_count;
  totals.f1 = totals.precision + totals.recall === 0 ? 0 : (2 * totals.precision * totals.recall) / (totals.precision + totals.recall);
  report.micro = totals;
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: report.status, samples: report.samples, samples_with_gold: report.samples_with_gold, micro: report.micro ?? null }));
