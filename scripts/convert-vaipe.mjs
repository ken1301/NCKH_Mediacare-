import { convertDataset } from '../src/dataset/vaipe-adapter.mjs';
import { loadSourceMetadata } from '../src/dataset/source-metadata.mjs';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const input = option('--input', 'dataset/external/vaipe-p');
const output = option('--output', 'dataset/external/vaipe-p-medicare-annotations');
const sourceMetadata = await loadSourceMetadata();
const permissionNote = sourceMetadata.access_status === 'authorized_for_research'
  ? 'quyền nghiên cứu đã được xác nhận; vẫn cần privacy/annotation review.'
  : 'chưa xác nhận quyền sử dụng.';
const manifest = await convertDataset(input, output, {
  sourceStatus: sourceMetadata.access_status,
  sourceLicense: sourceMetadata.license,
  permissionNote
});
console.log(`Conversion complete: ${manifest.annotations_written} annotation(s)`);
console.log(`Output: ${manifest.output_path}`);
if (manifest.warnings.length > 0) console.warn(`Warnings: ${manifest.warnings.length}`);
