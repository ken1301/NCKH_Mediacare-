import test from 'node:test';
import assert from 'node:assert/strict';
import { boxIoU, characterErrorRate, evaluateEntities, evaluateOcrWords, wordErrorRate } from '../src/dataset/baseline-metrics.mjs';

test('OCR metrics normalize Vietnamese text and compute edit rates', () => {
  assert.equal(characterErrorRate('Sáng 1 Viên', 'sang 1 vien'), 0);
  assert.equal(wordErrorRate('Sáng 1 Viên', 'sang 1 vien'), 0);
});

test('boxIoU returns expected overlap', () => {
  assert.equal(boxIoU([0, 0, 10, 10], [0, 0, 10, 10]), 1);
  assert.equal(boxIoU([0, 0, 10, 10], [10, 10, 20, 20]), 0);
});

test('entity evaluation matches same-label boxes and reports F1/text accuracy', () => {
  const result = evaluateEntities(
    [{ label: 'DRUG', text: 'Augmentin', bbox: [0, 0, 100, 20] }],
    [{ label: 'DRUG', text: 'Augrnentin', bbox: [1, 1, 99, 19] }]
  );
  assert.equal(result.matched_count, 1);
  assert.equal(result.f1, 1);
  assert.equal(result.text_exact_accuracy, 0);
  assert.ok(result.mean_cer > 0);
});

test('OCR evaluation matches boxes without requiring semantic labels', () => {
  const result = evaluateOcrWords(
    [{ text: 'Augmentin', bbox: [0, 0, 100, 20] }],
    [{ text: 'Augrnentin', bbox: [1, 1, 99, 19] }]
  );
  assert.equal(result.matched_count, 1);
  assert.equal(result.f1, 1);
  assert.equal(result.text_exact_accuracy, 0);
  assert.ok(result.mean_cer > 0);
});
