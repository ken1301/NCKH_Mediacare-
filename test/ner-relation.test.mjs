import test from 'node:test';
import assert from 'node:assert/strict';
import { annotationToBioExample, evaluateRelations, wordsToBio } from '../src/dataset/ner-relation.mjs';

test('converts OCR words to BIO tags using entity boxes', () => {
  const result = wordsToBio([
    { id: 'w1', text: 'Augmentin', bbox: [0, 0, 50, 20] },
    { id: 'w2', text: '625', bbox: [55, 0, 80, 20] },
    { id: 'w3', text: 'mg', bbox: [82, 0, 100, 20] }
  ], [
    { id: 'e1', label: 'DRUG', text: 'Augmentin', bbox: [0, 0, 50, 20] },
    { id: 'e2', label: 'STRENGTH', text: '625 mg', bbox: [55, 0, 100, 20] }
  ]);
  assert.deepEqual(result.tokens.map((token) => token.tag), ['B-DRUG', 'B-STRENGTH', 'I-STRENGTH']);
  assert.deepEqual(result.unmatched_entity_ids, []);
});

test('evaluates relation triples with exact endpoints and type', () => {
  const result = evaluateRelations(
    [{ type: 'HAS_STRENGTH', source_entity_id: 'd1', target_entity_id: 's1' }],
    [{ type: 'HAS_STRENGTH', source_entity_id: 'd1', target_entity_id: 's1' }, { type: 'HAS_DOSE', source_entity_id: 'd1', target_entity_id: 'x1' }]
  );
  assert.equal(result.true_positive, 1);
  assert.equal(result.false_positive, 1);
  assert.equal(result.false_negative, 0);
  assert.equal(result.f1, 2 / 3);
});

test('BIO example is not training-ready without OCR words', () => {
  const result = annotationToBioExample({
    sample_id: 'rx-1',
    entities: [{ id: 'd1', label: 'DRUG', text: 'A', bbox: [0, 0, 10, 10] }],
    relations: []
  }, [{ id: 'w1', text: 'A', bbox: [0, 0, 10, 10] }]);
  assert.equal(result.ready_for_training, true);
  assert.equal(result.tokens[0].tag, 'B-DRUG');
});
