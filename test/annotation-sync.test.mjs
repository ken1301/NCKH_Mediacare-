import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  annotationFingerprint,
  exportAnnotationBundle,
  mergeAnnotationBundles
} from '../src/dataset/annotation-sync.mjs';

function record({ strength = '500 mg', status = 'needs_review', reviewed = false, approved = false, needsReview = true } = {}) {
  return {
    schema_version: 'medication.annotation.v1',
    sample_id: 'SAMPLE_1',
    image: { file_name: 'SAMPLE_1.png', width: 100, height: 100, difficulty: 'easy' },
    privacy: { de_identified: reviewed, reviewed, approved_for_research: approved },
    split: 'train',
    entities: [
      { id: 'drug-a', label: 'DRUG', text: 'Paracetamol', bbox: [1, 1, 20, 10], needs_review: needsReview },
      { id: 'strength-a', label: 'STRENGTH', text: strength, bbox: [21, 1, 40, 10], needs_review: needsReview }
    ],
    relations: [
      { id: 'relation-a', type: 'HAS_STRENGTH', source_entity_id: 'drug-a', target_entity_id: 'strength-a', needs_review: needsReview }
    ],
    annotation_status: status,
    review: { annotator_id: 'annotator-a', reviewer_id: null, notes: [] }
  };
}

async function writeRecord(folder, annotator, value) {
  const target = path.join(folder, annotator);
  await import('node:fs/promises').then(({ mkdir }) => mkdir(target, { recursive: true }));
  await writeFile(path.join(target, 'SAMPLE_1.json'), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

test('annotation export writes validated bundle and manifest', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'medicare-sync-export-'));
  try {
    await writeRecord(root, 'annotator-a', record());
    const result = await exportAnnotationBundle({
      annotator: 'annotator-a',
      input: path.join(root, 'annotator-a'),
      output: path.join(root, 'incoming', 'annotator-a'),
      repositoryCommit: 'test-commit'
    });
    assert.equal(result.records, 1);
    const manifest = JSON.parse(await readFile(path.join(root, 'incoming', 'annotator-a', 'manifest.json'), 'utf8'));
    assert.equal(manifest.schema_version, 'medicare.annotation.bundle.v1');
    assert.equal(manifest.repository_commit, 'test-commit');
    assert.equal(manifest.records[0].sample_id, 'SAMPLE_1');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('annotation fingerprint ignores local entity and relation ids', () => {
  const left = record();
  const right = structuredClone(left);
  right.entities[0].id = 'different-drug-id';
  right.entities[1].id = 'different-strength-id';
  right.relations[0].id = 'different-relation-id';
  right.relations[0].source_entity_id = 'different-drug-id';
  right.relations[0].target_entity_id = 'different-strength-id';
  assert.equal(annotationFingerprint(left), annotationFingerprint(right));
});

test('annotation merge reports conflicts and promotes reviewer-approved gold only', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'medicare-sync-merge-'));
  try {
    const incoming = path.join(root, 'incoming');
    await writeRecord(incoming, 'annotator-a', record({ strength: '500 mg' }));
    await writeRecord(incoming, 'annotator-b', record({ strength: '0.5 g' }));
    await writeRecord(incoming, 'reviewer', record({
      status: 'complete',
      reviewed: true,
      approved: true,
      needsReview: false,
      strength: '500 mg'
    }));
    const report = await mergeAnnotationBundles({
      input: incoming,
      goldOutput: path.join(root, 'gold'),
      reportOutput: path.join(root, 'merge-report.json')
    });
    assert.equal(report.summary.conflicts, 1);
    assert.equal(report.summary.gold_written, 1);
    const gold = JSON.parse(await readFile(path.join(root, 'gold', 'SAMPLE_1.json'), 'utf8'));
    assert.equal(gold.annotation_status, 'complete');
    assert.equal(gold.privacy.approved_for_research, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
