import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  exportAnnotationBundle,
  importAnnotationBundles,
  mergeAnnotationBundles
} from '../src/dataset/annotation-sync.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function repositoryCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const command = process.argv[2] ?? 'help';
const annotator = option('--annotator', 'annotator-a');
const workingRoot = path.resolve(option('--working', 'dataset/working/medication-annotations'));
const incomingRoot = path.resolve(option('--incoming', 'dataset/annotations/incoming'));
const goldRoot = path.resolve(option('--gold', 'dataset/annotations/gold'));
const reportPath = path.resolve(option('--report', 'dataset/annotations/merge-report.json'));

if (command === 'export') {
  const result = await exportAnnotationBundle({
    annotator,
    input: path.join(workingRoot, annotator),
    output: path.join(incomingRoot, annotator),
    repositoryCommit: repositoryCommit()
  });
  console.log(`Exported ${result.records} annotation(s) for ${annotator}.`);
  console.log(`Bundle: ${result.output}`);
} else if (command === 'import') {
  const result = await importAnnotationBundles({ input: incomingRoot, output: workingRoot });
  console.log(`Imported ${result.imported.length} annotation(s).`);
  if (result.invalid.length > 0) console.log(`Skipped invalid records: ${result.invalid.length}.`);
} else if (command === 'merge') {
  const report = await mergeAnnotationBundles({ input: incomingRoot, goldOutput: goldRoot, reportOutput: reportPath });
  console.log(`Samples considered: ${report.summary.samples}`);
  console.log(`Annotator agreements: ${report.summary.agreements}; conflicts: ${report.summary.conflicts}.`);
  console.log(`Reviewer-ready gold: ${report.summary.gold_written}.`);
  console.log(`Report: ${reportPath}`);
} else {
  console.log('Usage:');
  console.log('  npm run annotation:export -- --annotator annotator-a');
  console.log('  npm run annotation:import');
  console.log('  npm run annotation:merge');
  process.exitCode = 1;
}
