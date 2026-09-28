import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractDrugNameAndStrength, normalizeDrugText, parseStrength } from '../src/catalog/drug-catalog.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = option('--input', 'dataset/external/vaipe-p');
const manifestPath = option('--manifest', 'dataset/metadata/vaipe-p-baseline/train.json');
const output = option('--output', 'dataset/metadata/vaipe-p-baseline/drug-candidates.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const candidateMap = new Map();

for (const sample of manifest) {
  const annotation = JSON.parse(await readFile(path.resolve(input, sample.annotation), 'utf8'));
  for (const word of annotation.filter((item) => item.label === 'drugname')) {
    const parsed = extractDrugNameAndStrength(word.text);
    const normalized = normalizeDrugText(parsed.drug_name);
    if (normalized.length < 3) continue;
    const candidate = candidateMap.get(normalized) ?? {
      candidate_id: `vaipe-local-${createHash('sha1').update(normalized).digest('hex').slice(0, 12)}`,
      normalized_name: normalized,
      brand_name: parsed.drug_name,
      raw_texts: [],
      strengths: [],
      occurrence_count: 0,
      sample_ids: [],
      status: 'candidate_only',
      active_ingredients: [],
      source: {
        source_name: 'VAIPE-P Kaggle mirror — local candidate extraction',
        source_url: 'https://www.kaggle.com/datasets/litrdng/vaipe-p',
        access_status: 'unverified',
        license: 'Unknown'
      }
    };
    candidate.occurrence_count += 1;
    if (!candidate.sample_ids.includes(sample.sample_id)) candidate.sample_ids.push(sample.sample_id);
    if (!candidate.raw_texts.includes(parsed.raw_text)) candidate.raw_texts.push(parsed.raw_text);
    for (const strengthText of parsed.strengths) {
      const strength = parseStrength(strengthText);
      if (strength && !candidate.strengths.some((item) => item.value === strength.value && item.unit === strength.unit)) {
        candidate.strengths.push({ value: strength.value, unit: strength.unit });
      }
    }
    candidateMap.set(normalized, candidate);
  }
}

const candidates = [...candidateMap.values()].sort((left, right) => right.occurrence_count - left.occurrence_count || left.normalized_name.localeCompare(right.normalized_name));
const report = {
  generated_at: new Date().toISOString(),
  source_manifest: path.resolve(manifestPath),
  candidate_count: candidates.length,
  source_occurrences: candidates.reduce((sum, candidate) => sum + candidate.occurrence_count, 0),
  status: 'candidate_only — không phải trusted drug catalog',
  candidates
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ candidate_count: report.candidate_count, source_occurrences: report.source_occurrences, output: path.resolve(output) }));
