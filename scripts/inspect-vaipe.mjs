import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectDataset, reportToMarkdown } from '../src/dataset/vaipe-adapter.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = option('--input', 'dataset/external/vaipe-p');
const output = option('--output', 'dataset/metadata/vaipe-p-inspection');
const report = await inspectDataset(input);
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await writeFile(path.join(output, 'report.md'), reportToMarkdown(report), 'utf8');
console.log(`Inspection complete: ${path.resolve(output)}`);
console.log(JSON.stringify(report.totals));
