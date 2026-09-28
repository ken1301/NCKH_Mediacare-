import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { summarizeMedicationAnnotations, validateMedicationAnnotation } from '../src/dataset/medication-annotation.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = path.resolve(option('--input', 'dataset/external/vaipe-p-medicare-annotations'));
const output = path.resolve(option('--output', 'dataset/metadata/vaipe-p-baseline/annotation-readiness.json'));
const files = (await readdir(input)).filter((file) => file.toLowerCase().endsWith('.json') && file !== 'conversion-manifest.json').sort();
const records = [];
const invalidDetails = [];
const legacyFiles = [];
for (const file of files) {
  const sourceRecord = JSON.parse(await readFile(path.join(input, file), 'utf8'));
  const isLegacy = sourceRecord.annotation_status === undefined;
  const record = isLegacy
    ? {
        ...sourceRecord,
        annotation_status: sourceRecord.review?.status === 'draft' ? 'partial' : 'needs_review'
      }
    : sourceRecord;
  if (isLegacy) legacyFiles.push(file);
  records.push(record);
  const result = validateMedicationAnnotation(record);
  if (!result.valid) invalidDetails.push({ file, sample_id: record.sample_id ?? null, errors: result.errors });
}

const report = {
  generated_at: new Date().toISOString(),
  input,
  schema_version: 'medication.annotation.v1',
  annotation_scope: 'validation_only; does not create medication labels or relations',
  legacy_compatibility: {
    enabled: legacyFiles.length > 0,
    files: legacyFiles.length,
    note: 'Legacy VAIPE-converted records are validated with inferred annotation_status; source files are not rewritten.'
  },
  summary: summarizeMedicationAnnotations(records),
  invalid_details: invalidDetails
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Validated ${report.summary.samples} annotation file(s).`);
console.log(`Valid: ${report.summary.valid_samples}; invalid: ${report.summary.invalid_samples}.`);
console.log(`Entities: ${report.summary.entities}; relations: ${report.summary.relations}.`);
console.log(`Report: ${output}`);
