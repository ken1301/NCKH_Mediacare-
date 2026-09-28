import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMedicationDraft, groupOcrWordsIntoLines } from '../src/pipeline/medication-understanding.mjs';

const catalog = [
  { drug_database_id: 'candidate:ren april', brand_name: 'RENAPRIL', aliases: ['RENAPRIL 5MG'], strengths: [{ value: 5, unit: 'mg' }] }
];

test('groups OCR words into visual lines', () => {
  const lines = groupOcrWordsIntoLines([
    { text: 'RENAPRIL', bbox: [10, 10, 80, 30], confidence: 0.9 },
    { text: '5MG', bbox: [85, 11, 120, 30], confidence: 0.8 },
    { text: 'Sáng', bbox: [10, 50, 50, 70], confidence: 0.9 }
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].text, 'RENAPRIL 5MG');
});

test('draft keeps candidate-only links in needs_verification', () => {
  const draft = buildMedicationDraft({
    prescriptionId: 'rx-1',
    ocrWords: [
      { text: 'RENAPRIL', bbox: [10, 10, 80, 30] },
      { text: '5MG', bbox: [85, 11, 120, 30] }
    ],
    catalog,
    catalogIsTrusted: false
  });
  assert.equal(draft.plan.medications.length, 1);
  assert.equal(draft.plan.status, 'needs_verification');
  assert.equal(draft.plan.medications[0].verification.status, 'needs_review');
  assert.deepEqual(draft.plan.medications[0].verification.fields_to_verify, ['drug', 'strength']);
});
