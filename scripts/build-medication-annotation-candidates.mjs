import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildMedicationAnnotationCandidate } from '../src/dataset/medication-annotation-candidates.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = path.resolve(option('--input', 'dataset/external/vaipe-p/public_train/label'));
const output = path.resolve(option('--output', 'dataset/metadata/vaipe-p-baseline/medication-annotation-candidates.jsonl'));
const files = (await readdir(input)).filter((file) => file.toLowerCase().endsWith('.json')).sort();
const candidates = [];
let entityCount = 0;
let relationCount = 0;
let quantityCount = 0;
for (const file of files) {
  const record = JSON.parse(await readFile(path.join(input, file), 'utf8'));
  const candidate = buildMedicationAnnotationCandidate(record, file);
  candidate.sample_id = path.basename(file, path.extname(file));
  entityCount += candidate.candidate_entities.length;
  relationCount += candidate.candidate_relations.length;
  quantityCount += candidate.total_quantity_candidates.length;
  candidates.push(candidate);
}
await writeFile(output, `${candidates.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
console.log(`Candidate samples: ${candidates.length}`);
console.log(`Candidate entities: ${entityCount}`);
console.log(`Candidate relations (all needs_review): ${relationCount}`);
console.log(`Total quantity candidates: ${quantityCount}`);
console.log(`Output: ${output}`);
