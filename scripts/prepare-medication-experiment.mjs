import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateMedicationAnnotation } from '../src/dataset/medication-annotation.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

const input = path.resolve(option('--input', 'dataset/external/vaipe-p-medicare-annotations'));
const output = path.resolve(option('--output', 'dataset/metadata/vaipe-p-baseline/medication-experiment-readiness.json'));
const files = (await readdir(input)).filter((file) => file.toLowerCase().endsWith('.json') && file !== 'conversion-manifest.json').sort();
const records = [];
const blockers = [];

for (const file of files) {
  const record = JSON.parse(await readFile(path.join(input, file), 'utf8'));
  const validation = validateMedicationAnnotation(record);
  if (!validation.valid) continue;
  const isComplete = record.annotation_status === 'complete';
  const approved = record.privacy?.approved_for_research === true;
  const reviewed = record.privacy?.reviewed === true;
  const hasRelations = Array.isArray(record.relations) && record.relations.length > 0;
  if (isComplete && approved && reviewed && hasRelations) records.push({ file, sample_id: record.sample_id });
}

if (records.length === 0) {
  blockers.push('No complete, reviewed, approved annotation with at least one medication relation is available.');
}

const split = { train: [], validation: [], test: [] };
for (const record of [...records].sort((left, right) => hash(left.sample_id) - hash(right.sample_id))) {
  const ratio = (hash(record.sample_id) % 1000) / 1000;
  const target = ratio < 0.7 ? 'train' : ratio < 0.85 ? 'validation' : 'test';
  split[target].push(record);
}

const report = {
  generated_at: new Date().toISOString(),
  status: blockers.length > 0 ? 'blocked' : 'ready_for_annotation_driven_experiment',
  input,
  policy: {
    require_annotation_status: 'complete',
    require_privacy_review: true,
    require_approved_for_research: true,
    require_relations: true,
    split_by: 'prescription/sample_id; never split crops from one prescription'
  },
  eligible_samples: records.length,
  split_counts: Object.fromEntries(Object.entries(split).map(([key, value]) => [key, value.length])),
  split,
  blockers
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Experiment gate status: ${report.status}`);
console.log(`Eligible samples: ${report.eligible_samples}`);
if (blockers.length > 0) console.log(`Blocker: ${blockers.join(' ')}`);
console.log(`Report: ${output}`);
