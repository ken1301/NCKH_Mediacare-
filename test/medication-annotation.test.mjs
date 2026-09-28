import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeMedicationAnnotations,
  validateMedicationAnnotation
} from '../src/dataset/medication-annotation.mjs';

function entity(id, label, text) {
  return { id, label, text, bbox: [0, 0, 10, 10] };
}

test('validates a complete drug relation annotation', () => {
  const result = validateMedicationAnnotation({
    schema_version: 'medication.annotation.v1',
    sample_id: 'rx-1',
    annotation_status: 'complete',
    entities: [entity('drug-1', 'DRUG', 'Augmentin'), entity('strength-1', 'STRENGTH', '625 mg')],
    relations: [{ id: 'rel-1', type: 'HAS_STRENGTH', source_entity_id: 'drug-1', target_entity_id: 'strength-1' }]
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('rejects a relation with the wrong source or target label', () => {
  const result = validateMedicationAnnotation({
    sample_id: 'rx-2',
    annotation_status: 'partial',
    entities: [entity('instruction-1', 'INSTRUCTION', 'uống sau ăn'), entity('drug-1', 'DRUG', 'Augmentin')],
    relations: [{ id: 'rel-1', type: 'HAS_TIMING', source_entity_id: 'instruction-1', target_entity_id: 'drug-1' }]
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('source must be DRUG')));
  assert.ok(result.errors.some((error) => error.includes('target label must be TIMING')));
});

test('partial VAIPE-style annotation is valid but warns that relations are unavailable', () => {
  const result = validateMedicationAnnotation({
    sample_id: 'VAIPE_P_TRAIN_0',
    annotation_status: 'partial',
    entities: [entity('drug-1', 'DRUG', 'RENAPRIL')],
    relations: []
  });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((warning) => warning.includes('no medication relations')));
});

test('summarizes labels and relation coverage without inventing metrics', () => {
  const summary = summarizeMedicationAnnotations([
    { sample_id: 'rx-1', annotation_status: 'partial', entities: [entity('drug-1', 'DRUG', 'A')], relations: [] },
    { sample_id: 'rx-2', annotation_status: 'needs_review', entities: [], relations: [] }
  ]);
  assert.equal(summary.samples, 2);
  assert.equal(summary.entities_by_label.DRUG, 1);
  assert.equal(summary.relations, 0);
  assert.equal(summary.invalid_samples, 0);
});
