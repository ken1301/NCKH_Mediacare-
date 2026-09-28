import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnotationQueue } from '../src/dataset/medication-annotation-queue.mjs';

test('annotation queue preserves review requirements without inventing relations', () => {
  const queue = buildAnnotationQueue([
    {
      sample_id: 'rx-1',
      image: { file_name: 'rx-1.png' },
      entities: [
        { id: 'drug-1', label: 'DRUG', bbox: [0, 0, 10, 10] },
        { id: 'instruction-1', label: 'INSTRUCTION', bbox: [0, 12, 10, 20] }
      ],
      relations: [],
      review: { status: 'draft' },
      privacy: { reviewed: false, approved_for_research: false }
    }
  ], { sourceFiles: ['rx-1.json'], generatedAt: '2026-09-28T00:00:00.000Z' });

  assert.equal(queue.total_items, 1);
  assert.equal(queue.policy.creates_gold_relations, false);
  assert.equal(queue.policy.creates_metrics, false);
  assert.equal(queue.items[0].existing_relation_count, 0);
  assert.equal(queue.items[0].entity_counts.DRUG, 1);
  assert.equal(queue.items[0].entity_counts.INSTRUCTION, 1);
  assert.ok(queue.items[0].actions.includes('split_instruction_into_typed_medication_fields'));
  assert.ok(queue.items[0].actions.includes('annotate_medication_relations_after_entity_review'));
});
