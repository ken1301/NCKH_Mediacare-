import { readFile } from 'node:fs/promises';

export const DEFAULT_SOURCE_METADATA = Object.freeze({
  license: 'Unknown',
  access_status: 'unverified',
  approved_for_publication: false
});

export async function loadSourceMetadata(manifestPath = 'dataset/external/source_manifest.json') {
  try {
    const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
    return {
      ...DEFAULT_SOURCE_METADATA,
      license: parsed.license ?? DEFAULT_SOURCE_METADATA.license,
      access_status: parsed.access_status ?? DEFAULT_SOURCE_METADATA.access_status,
      approved_for_publication: parsed.approved_for_publication === true
    };
  } catch {
    return { ...DEFAULT_SOURCE_METADATA };
  }
}
