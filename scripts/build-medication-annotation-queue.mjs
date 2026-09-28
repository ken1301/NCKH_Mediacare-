import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildAnnotationQueue } from '../src/dataset/medication-annotation-queue.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = path.resolve(option('--input', 'dataset/external/vaipe-p-medicare-annotations'));
const output = path.resolve(option('--output', 'dataset/metadata/vaipe-p-baseline/medication-annotation-queue.json'));
const files = (await readdir(input))
  .filter((file) => file.toLowerCase().endsWith('.json') && file !== 'conversion-manifest.json')
  .sort();
const records = [];
for (const file of files) records.push(JSON.parse(await readFile(path.join(input, file), 'utf8')));

const queue = buildAnnotationQueue(records, {
  sourceFiles: files,
  generatedAt: new Date().toISOString()
});
await writeFile(output, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
console.log(`Annotation queue items: ${queue.total_items}`);
console.log(`Existing relations retained, not generated: ${queue.items.reduce((sum, item) => sum + item.existing_relation_count, 0)}`);
console.log(`Output: ${output}`);
