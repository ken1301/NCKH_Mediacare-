import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { annotationToBioExample } from '../src/dataset/ner-relation.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = path.resolve(option('--input', 'dataset/external/vaipe-p-medicare-annotations'));
const output = path.resolve(option('--output', 'dataset/metadata/vaipe-p-baseline/medication-bio.jsonl'));
const files = (await readdir(input)).filter((file) => file.toLowerCase().endsWith('.json') && file !== 'conversion-manifest.json').sort();
const examples = [];
let legacyFallbackCount = 0;
let readyCount = 0;

for (const file of files) {
  const annotation = JSON.parse(await readFile(path.join(input, file), 'utf8'));
  const words = annotation.ocr_words ?? annotation.entities?.map((entity) => ({
    id: entity.id,
    text: entity.text,
    bbox: entity.bbox
  }));
  if (!annotation.ocr_words) legacyFallbackCount += 1;
  const example = annotationToBioExample(annotation, words);
  if (example.ready_for_training && annotation.ocr_words) readyCount += 1;
  examples.push(JSON.stringify({
    ...example,
    token_source: annotation.ocr_words ? 'ocr_words' : 'entity_bbox_fallback',
    ready_for_training: example.ready_for_training && Boolean(annotation.ocr_words)
  }));
}

await writeFile(output, `${examples.join('\n')}\n`, 'utf8');
console.log(`Built ${examples.length} BIO example(s).`);
console.log(`Training-ready examples: ${readyCount}; legacy fallback examples: ${legacyFallbackCount}.`);
console.log(`Output: ${output}`);
