import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildMedicationDraft } from '../src/pipeline/medication-understanding.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = option('--input', 'dataset/external/vaipe-p');
const manifestPath = option('--manifest', 'dataset/metadata/vaipe-p-baseline/test.json');
const candidatePath = option('--candidates', 'dataset/metadata/vaipe-p-baseline/drug-candidates.json');
const predictionsPath = option('--predictions', 'dataset/metadata/vaipe-p-baseline/predictions-test.json');
const output = option('--output', 'dataset/metadata/vaipe-p-baseline/medication-drafts.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const candidateReport = JSON.parse(await readFile(candidatePath, 'utf8'));
const candidates = candidateReport.candidates.map((candidate) => ({
  drug_database_id: candidate.candidate_id,
  brand_name: candidate.brand_name,
  aliases: candidate.raw_texts,
  strengths: candidate.strengths
}));
const predictions = JSON.parse(await readFile(predictionsPath, 'utf8'));
const predictionMap = new Map(predictions.map((item) => [item.sample_id, item]));
const drafts = [];
for (const sample of manifest) {
  const result = buildMedicationDraft({
    prescriptionId: sample.sample_id,
    ocrWords: predictionMap.get(sample.sample_id)?.ocr ?? [],
    catalog: candidates,
    catalogIsTrusted: false,
    linkOptions: { threshold: 0.78, ambiguity_margin: 0.04 }
  });
  drafts.push({ sample_id: sample.sample_id, ...result });
}
const summary = {
  generated_at: new Date().toISOString(),
  status: 'exploratory_candidate_catalog',
  sample_count: drafts.length,
  samples_with_medication_draft: drafts.filter((item) => item.plan.medications.length > 0).length,
  medication_count: drafts.reduce((sum, item) => sum + item.plan.medications.length, 0),
  needs_verification_count: drafts.reduce((sum, item) => sum + item.plan.medications.filter((medication) => medication.verification.status === 'needs_review').length, 0),
  warning: 'Mọi medication draft đều cần user verification vì catalog chưa phải nguồn thuốc chính thức và OCR chưa có semantic relation.'
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ summary, drafts }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary));
