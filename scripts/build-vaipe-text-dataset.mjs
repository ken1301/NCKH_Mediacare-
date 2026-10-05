import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const inputDir = process.argv[2] ?? 'dataset/external/vaipe-p/public_train/label';
const manifestDir = process.argv[3] ?? 'dataset/metadata/vaipe-p-baseline';
const outputDir = process.argv[4] ?? 'dataset/processed/vaipe-text';

const labels = new Map();
for (const file of (await readdir(inputDir)).filter((name) => name.endsWith('.json'))) {
  const records = JSON.parse(await readFile(path.join(inputDir, file), 'utf8'));
  const sampleId = file.replace(/\.json$/i, '');
  const words = records
    .filter((record) => record?.text && Array.isArray(record.box))
    .map((record) => ({
      text: String(record.text).trim(),
      label: String(record.label ?? 'other'),
      bbox: record.box.map(Number),
      mapping: record.mapping ?? null,
    }))
    .sort((a, b) => (a.bbox[1] - b.bbox[1]) || (a.bbox[0] - b.bbox[0]));
  labels.set(sampleId, {
    sample_id: sampleId,
    image: `public_train/image/${sampleId}.png`,
    text: words.map((word) => word.text).join('\n'),
    words,
  });
}

const manifests = {};
for (const split of ['train', 'validation', 'test']) {
  manifests[split] = JSON.parse(await readFile(path.join(manifestDir, `${split}.json`), 'utf8'));
}

await mkdir(outputDir, { recursive: true });
const summary = { total: labels.size, splits: {} };
for (const [split, samples] of Object.entries(manifests)) {
  const splitDir = path.join(outputDir, split);
  await mkdir(splitDir, { recursive: true });
  const rows = [];
  for (const sample of samples) {
    const item = labels.get(sample.sample_id);
    if (!item) continue;
    rows.push(item);
    await writeFile(path.join(splitDir, `${item.sample_id}.txt`), `${item.text}\n`, 'utf8');
    await writeFile(path.join(splitDir, `${item.sample_id}.json`), `${JSON.stringify(item, null, 2)}\n`, 'utf8');
  }
  await writeFile(path.join(outputDir, `${split}.jsonl`), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  summary.splits[split] = rows.length;
}

await writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary));
