import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSourceMetadata } from '../src/dataset/source-metadata.mjs';

test('source metadata falls back safely when local permission manifest is absent', async () => {
  const metadata = await loadSourceMetadata('dataset/external/does-not-exist.json');
  assert.equal(metadata.access_status, 'unverified');
  assert.equal(metadata.license, 'Unknown');
  assert.equal(metadata.approved_for_publication, false);
});
