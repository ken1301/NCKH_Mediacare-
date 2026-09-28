import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMedicationAnnotationCandidate } from '../src/dataset/medication-annotation-candidates.mjs';

test('assisted annotation creates review-only candidates from VAIPE fields', () => {
  const candidate = buildMedicationAnnotationCandidate([
    { id: 1, label: 'drugname', text: '1) AUGMENTIN 625mg', box: [10, 10, 120, 30] },
    { id: 2, label: 'quantity', text: 'SL: 20 Viên', box: [200, 10, 280, 30] },
    { id: 3, label: 'other', text: 'Ghi chú Uống sau khi ăn:', box: [10, 32, 160, 50] },
    { id: 4, label: 'usage', text: 'Sáng 1 Viên', box: [10, 52, 100, 70] }
  ], 'VAIPE_P_TRAIN_0.json');

  assert.equal(candidate.status, 'candidate_only');
  assert.equal(candidate.annotation_status, 'needs_review');
  assert.equal(candidate.privacy.approved_for_research, false);
  assert.ok(candidate.candidate_entities.some((entity) => entity.label === 'DRUG' && entity.text === 'AUGMENTIN'));
  assert.ok(candidate.candidate_entities.some((entity) => entity.label === 'STRENGTH'));
  assert.ok(candidate.candidate_entities.some((entity) => entity.label === 'DOSE'));
  assert.ok(candidate.candidate_entities.some((entity) => entity.label === 'TIMING'));
  assert.ok(candidate.candidate_relations.length > 0);
  assert.ok(candidate.candidate_relations.every((relation) => relation.needs_review === true));
  assert.equal(candidate.total_quantity_candidates[0].value, 20);
  assert.equal(candidate.warnings[0], 'candidate_only: không phải gold annotation.');
});
