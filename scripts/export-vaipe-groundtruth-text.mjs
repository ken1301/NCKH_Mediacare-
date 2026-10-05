import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const inputDir = process.argv[2] ?? 'dataset/external/vaipe-p/public_train/label';
const outputDir = process.argv[3] ?? 'dataset/processed/vaipe-text-groundtruth';
await mkdir(outputDir, { recursive: true });
const documents = [];

for (const file of (await readdir(inputDir)).filter((name) => name.endsWith('.json'))) {
  const records = JSON.parse(await readFile(path.join(inputDir, file), 'utf8'));
  const lines = [...records]
    .filter((record) => record?.text && Array.isArray(record.box))
    .sort((a, b) => (Number(a.box[1]) - Number(b.box[1])) || (Number(a.box[0]) - Number(b.box[0])));
  const text = lines.map((record) => String(record.text).trim()).join('\n');
  const sampleId = file.replace(/\.json$/i, '');
  const document = { sample_id: sampleId, text, source: 'VAIPE-P ground-truth word boxes', word_boxes: lines };
  documents.push(document);
  await writeFile(path.join(outputDir, `${sampleId}.txt`), `${text}\n`, 'utf8');
  await writeFile(path.join(outputDir, `${sampleId}.json`), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

await writeFile(path.join(outputDir, 'all.json'), `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'all.jsonl'), `${documents.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ documents: documents.length, output_dir: path.resolve(outputDir) }));
