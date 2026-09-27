import { convertDataset } from '../src/dataset/vaipe-adapter.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = option('--input', 'dataset/external/vaipe-p');
const output = option('--output', 'dataset/external/vaipe-p-medicare-annotations');
const manifest = await convertDataset(input, output);
console.log(`Conversion complete: ${manifest.annotations_written} annotation(s)`);
console.log(`Output: ${manifest.output_path}`);
if (manifest.warnings.length > 0) console.warn(`Warnings: ${manifest.warnings.length}`);
