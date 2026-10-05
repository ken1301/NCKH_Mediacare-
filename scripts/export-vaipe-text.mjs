import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function groupWordsIntoLines(words) {
  const sorted = [...words]
    .filter((word) => word && String(word.text ?? '').trim() && Array.isArray(word.bbox))
    .map((word) => {
      const [x1, y1, x2, y2] = word.bbox.map(Number);
      return {
        text: String(word.text).trim(),
        bbox: [x1, y1, x2, y2],
        confidence: word.confidence == null ? null : number(word.confidence),
        centerY: (y1 + y2) / 2,
        height: Math.max(1, y2 - y1),
      };
    })
    .sort((a, b) => a.centerY - b.centerY || a.bbox[0] - b.bbox[0]);

  const lines = [];
  for (const word of sorted) {
    let target = lines.at(-1);
    const tolerance = Math.max(10, Math.min(30, word.height * 0.65));
    if (!target || Math.abs(word.centerY - target.centerY) > tolerance) {
      target = { centerY: word.centerY, words: [] };
      lines.push(target);
    }
    target.words.push(word);
    target.centerY = target.words.reduce((sum, item) => sum + item.centerY, 0) / target.words.length;
  }

  return lines.map((line) => {
    line.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
    const x1 = Math.min(...line.words.map((word) => word.bbox[0]));
    const y1 = Math.min(...line.words.map((word) => word.bbox[1]));
    const x2 = Math.max(...line.words.map((word) => word.bbox[2]));
    const y2 = Math.max(...line.words.map((word) => word.bbox[3]));
    return {
      text: line.words.map((word) => word.text).join(' ').replace(/\s+([,.;:])/g, '$1'),
      bbox: [x1, y1, x2, y2],
      confidence: line.words.filter((word) => word.confidence != null).length
        ? line.words.reduce((sum, word) => sum + word.confidence, 0) / line.words.filter((word) => word.confidence != null).length
        : null,
      words: line.words.map(({ text, bbox, confidence }) => ({ text, bbox, confidence })),
    };
  });
}

const predictionsPath = process.argv[2];
const outputDir = process.argv[3] ?? 'dataset/processed/vaipe-text';
if (!predictionsPath) {
  console.error('Usage: node scripts/export-vaipe-text.mjs <predictions.json> [output-dir]');
  process.exit(1);
}

const predictions = JSON.parse(await readFile(predictionsPath, 'utf8'));
await mkdir(outputDir, { recursive: true });
const documents = [];

for (const prediction of predictions) {
  const lines = groupWordsIntoLines(prediction.ocr ?? []);
  const sampleId = String(prediction.sample_id ?? `sample_${documents.length + 1}`);
  const text = lines.map((line) => line.text).join('\n');
  const document = {
    sample_id: sampleId,
    text,
    lines,
    error: prediction.error ?? null,
  };
  documents.push(document);
  await writeFile(path.join(outputDir, `${sampleId}.txt`), `${text}\n`, 'utf8');
  await writeFile(path.join(outputDir, `${sampleId}.json`), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

await writeFile(path.join(outputDir, 'all.json'), `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
await writeFile(path.join(outputDir, 'all.jsonl'), `${documents.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ documents: documents.length, output_dir: path.resolve(outputDir), non_empty: documents.filter((item) => item.text).length }));
