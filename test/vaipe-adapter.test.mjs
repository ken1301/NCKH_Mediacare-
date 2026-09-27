import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { convertDataset, inspectDataset } from '../src/dataset/vaipe-adapter.mjs';

test('inspectDataset counts images and recognized labels without reading raw images', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'medicare-inspect-'));
  try {
    await writeFile(path.join(root, 'rx-1.jpg'), 'not-an-image');
    await writeFile(path.join(root, 'labels.json'), JSON.stringify({
      entities: [{ label: 'DRUG' }, { label: 'strength' }],
      relations: [{ type: 'HAS_STRENGTH' }]
    }));
    const report = await inspectDataset(root);
    assert.equal(report.totals.images, 1);
    assert.equal(report.entity_label_counts.DRUG, 1);
    assert.equal(report.entity_label_counts.STRENGTH, 1);
    assert.equal(report.relation_type_counts.HAS_STRENGTH, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('convertDataset maps generic medication fields conservatively', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'medicare-convert-'));
  const output = path.join(root, 'out');
  try {
    await writeFile(path.join(root, 'records.json'), JSON.stringify([{
      id: 'rx-001',
      image: 'rx-001.jpg',
      drug: 'Augrnentin',
      strength: '625rng',
      dose: '1 viên',
      frequency: '2 lần/ngày'
    }]));
    const manifest = await convertDataset(root, output);
    assert.equal(manifest.annotations_written, 1);
    const converted = JSON.parse(await readFile(path.join(output, 'rx-001.json'), 'utf8'));
    assert.deepEqual(converted.entities.map((entity) => entity.label), ['DRUG', 'STRENGTH', 'DOSE', 'FREQUENCY']);
    assert.deepEqual(converted.relations.map((relation) => relation.type), ['HAS_STRENGTH', 'HAS_DOSE', 'HAS_FREQUENCY']);
    assert.equal(converted.entities[0].needs_review, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('convertDataset converts COCO xywh boxes and preserves missing text as review', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'medicare-coco-'));
  const output = path.join(root, 'out');
  try {
    await writeFile(path.join(root, 'coco.json'), JSON.stringify({
      images: [{ id: 1, file_name: 'rx.jpg' }],
      categories: [{ id: 1, name: 'DRUG' }],
      annotations: [{ id: 1, image_id: 1, category_id: 1, bbox: [10, 20, 30, 40] }]
    }));
    const manifest = await convertDataset(root, output);
    assert.equal(manifest.annotations_written, 1);
    const converted = JSON.parse(await readFile(path.join(output, 'rx.json'), 'utf8'));
    assert.deepEqual(converted.entities[0].bbox, [10, 20, 40, 60]);
    assert.equal(converted.entities[0].needs_review, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
