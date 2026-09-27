import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, open } from 'node:fs/promises';
import path from 'node:path';
import { walkFiles } from '../src/dataset/vaipe-adapter.mjs';

const TARGET_LABELS = new Set(['drugname', 'usage']);

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function imageRefFromAnnotation(relativeAnnotation) {
  return relativeAnnotation.replaceAll('\\', '/').replace('/label/', '/image/').replace(/\.json$/i, '.png');
}

function sampleIdFromAnnotation(relativeAnnotation) {
  return path.basename(relativeAnnotation, path.extname(relativeAnnotation));
}

function hashNumber(value) {
  return Number.parseInt(createHash('sha1').update(value).digest('hex').slice(0, 8), 16);
}

async function pngDimensions(filePath) {
  try {
    const handle = await open(filePath, 'r');
    const header = Buffer.alloc(24);
    await handle.read(header, 0, 24, 0);
    await handle.close();
    const signature = '89504e470d0a1a0a';
    if (header.subarray(0, 8).toString('hex') !== signature) return null;
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } catch {
    return null;
  }
}

function countLabels(words) {
  return words.reduce((result, word) => {
    const label = String(word.label ?? 'unknown');
    result[label] = (result[label] ?? 0) + 1;
    return result;
  }, {});
}

function validBox(box, dimensions) {
  if (!Array.isArray(box) || box.length < 4 || !box.every((value) => Number.isFinite(Number(value)))) return false;
  if (!dimensions) return true;
  const [x1, y1, x2, y2] = box.map(Number);
  return x1 >= 0 && y1 >= 0 && x2 >= x1 && y2 >= y1 && x2 <= dimensions.width && y2 <= dimensions.height;
}

async function readSamples(inputPath) {
  const files = (await walkFiles(inputPath)).filter((filePath) => path.extname(filePath).toLowerCase() === '.json');
  const samples = [];
  for (const filePath of files) {
    const relativeAnnotation = path.relative(inputPath, filePath);
    const parsed = JSON.parse(await readFile(filePath, 'utf8'));
    if (!Array.isArray(parsed) || !parsed.every((word) => word && typeof word === 'object' && word.label !== undefined && word.box !== undefined)) continue;
    const imageRef = imageRefFromAnnotation(relativeAnnotation);
    const imagePath = path.join(inputPath, imageRef);
    const dimensions = await pngDimensions(imagePath);
    const labels = countLabels(parsed);
    samples.push({
      sample_id: sampleIdFromAnnotation(relativeAnnotation),
      image: imageRef,
      annotation: relativeAnnotation,
      source_split: relativeAnnotation.replaceAll('\\', '/').includes('/public_test/') ? 'test' : 'train',
      word_box_count: parsed.length,
      label_counts: labels,
      target_box_count: parsed.filter((word) => TARGET_LABELS.has(String(word.label))).length,
      drug_count: labels.drugname ?? 0,
      usage_count: labels.usage ?? 0,
      image_width: dimensions?.width ?? null,
      image_height: dimensions?.height ?? null,
      valid_box_count: parsed.filter((word) => validBox(word.box, dimensions)).length,
      source_labels: parsed
    });
  }
  return samples;
}

function assignSplits(samples) {
  const sorted = [...samples].sort((left, right) => hashNumber(left.sample_id) - hashNumber(right.sample_id));
  const trainCount = Math.round(sorted.length * 0.70);
  const validationCount = Math.round(sorted.length * 0.15);
  return sorted.map((sample, index) => ({
    ...sample,
    split: index < trainCount ? 'train' : index < trainCount + validationCount ? 'validation' : 'test'
  }));
}

function summarize(samples) {
  const labels = {};
  const splitCounts = {};
  let totalWords = 0;
  let targetWords = 0;
  let validBoxes = 0;
  for (const sample of samples) {
    splitCounts[sample.split] = (splitCounts[sample.split] ?? 0) + 1;
    totalWords += sample.word_box_count;
    targetWords += sample.target_box_count;
    validBoxes += sample.valid_box_count;
    for (const [label, count] of Object.entries(sample.label_counts)) labels[label] = (labels[label] ?? 0) + count;
  }
  return {
    sample_count: samples.length,
    split_counts: splitCounts,
    total_word_boxes: totalWords,
    target_word_boxes: targetWords,
    valid_box_count: validBoxes,
    invalid_box_count: totalWords - validBoxes,
    raw_label_counts: labels,
    source_license: 'Unknown',
    access_status: 'unverified',
    approved_for_publication: false
  };
}

function publicSample(sample) {
  const { source_labels: _sourceLabels, ...safeSample } = sample;
  return safeSample;
}

const input = option('--input', 'dataset/external/vaipe-p');
const output = option('--output', 'dataset/metadata/vaipe-p-baseline');
const samples = assignSplits(await readSamples(input));
await mkdir(output, { recursive: true });
const summary = {
  generated_at: new Date().toISOString(),
  input_path: path.resolve(input),
  output_path: path.resolve(output),
  split_policy: 'SHA-1(sample_id) deterministic ordering; 70% train, 15% validation, 15% test; one prescription file stays in one split.',
  summary: summarize(samples),
  samples_with_missing_images: samples.filter((sample) => sample.image_width === null).map((sample) => sample.sample_id),
  samples_with_invalid_boxes: samples.filter((sample) => sample.invalid_box_count > 0).map((sample) => ({ sample_id: sample.sample_id, invalid_box_count: sample.invalid_box_count }))
};
await writeFile(path.join(output, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
for (const split of ['train', 'validation', 'test']) {
  const splitSamples = samples.filter((sample) => sample.split === split).map(publicSample);
  await writeFile(path.join(output, `${split}.json`), `${JSON.stringify(splitSamples, null, 2)}\n`, 'utf8');
  await writeFile(path.join(output, `${split}.jsonl`), `${splitSamples.map((sample) => JSON.stringify(sample)).join('\n')}\n`, 'utf8');
}
const allSamples = samples.map(publicSample);
await writeFile(path.join(output, 'all.json'), `${JSON.stringify(allSamples, null, 2)}\n`, 'utf8');
await writeFile(path.join(output, 'all.jsonl'), `${allSamples.map((sample) => JSON.stringify(sample)).join('\n')}\n`, 'utf8');
const markdown = [
  '# VAIPE-P baseline manifest',
  '',
  `Generated: ${summary.generated_at}`,
  '',
  '## Summary',
  '',
  `- Samples: ${summary.summary.sample_count}`,
  `- Train: ${summary.summary.split_counts.train ?? 0}`,
  `- Validation: ${summary.summary.split_counts.validation ?? 0}`,
  `- Test: ${summary.summary.split_counts.test ?? 0}`,
  `- Word boxes: ${summary.summary.total_word_boxes}`,
  `- Target boxes (` + '`drugname`/`usage`): ' + `${summary.summary.target_word_boxes}`,
  `- Valid boxes: ${summary.summary.valid_box_count}`,
  `- Invalid boxes: ${summary.summary.invalid_box_count}`,
  '',
  '## Raw labels',
  '',
  ...Object.entries(summary.summary.raw_label_counts).map(([label, count]) => `- ${label}: ${count}`),
  '',
  '## Status',
  '',
  '- License: Unknown',
  '- Access: unverified',
  '- Publication approval: false',
  '- This is a local development manifest; raw images are not committed.'
].join('\n') + '\n';
await writeFile(path.join(output, 'summary.md'), markdown, 'utf8');
console.log(JSON.stringify(summary.summary));
