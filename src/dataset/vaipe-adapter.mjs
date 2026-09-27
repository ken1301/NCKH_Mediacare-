import { createHash } from 'node:crypto';
import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.bmp']);
const ANNOTATION_EXTENSIONS = new Set(['.json', '.jsonl', '.ndjson', '.csv', '.txt']);
const IGNORED_DIRS = new Set(['node_modules', '.git']);

const LABEL_MAP = new Map([
  ['drug', 'DRUG'],
  ['medicine', 'DRUG'],
  ['medication', 'DRUG'],
  ['thuoc', 'DRUG'],
  ['activeingredient', 'ACTIVE_INGREDIENT'],
  ['ingredient', 'ACTIVE_INGREDIENT'],
  ['hoatchat', 'ACTIVE_INGREDIENT'],
  ['strength', 'STRENGTH'],
  ['dosagestrength', 'STRENGTH'],
  ['hamluong', 'STRENGTH'],
  ['dose', 'DOSE'],
  ['dosage', 'DOSE'],
  ['lieu', 'DOSE'],
  ['form', 'FORM'],
  ['dosageform', 'FORM'],
  ['dạngthuốc', 'FORM'],
  ['route', 'ROUTE'],
  ['administrationroute', 'ROUTE'],
  ['duongdung', 'ROUTE'],
  ['frequency', 'FREQUENCY'],
  ['tan suat', 'FREQUENCY'],
  ['tansuat', 'FREQUENCY'],
  ['solan', 'FREQUENCY'],
  ['duration', 'DURATION'],
  ['thoigian', 'DURATION'],
  ['timing', 'TIMING'],
  ['meal', 'TIMING'],
  ['instruction', 'INSTRUCTION'],
  ['directions', 'INSTRUCTION'],
  ['huongdan', 'INSTRUCTION']
]);

const FIELD_MAP = new Map([
  ['drug', 'DRUG'],
  ['drugname', 'DRUG'],
  ['medication', 'DRUG'],
  ['medicationname', 'DRUG'],
  ['medicine', 'DRUG'],
  ['thuoc', 'DRUG'],
  ['strength', 'STRENGTH'],
  ['dosagestrength', 'STRENGTH'],
  ['hamluong', 'STRENGTH'],
  ['dose', 'DOSE'],
  ['dosage', 'DOSE'],
  ['lieu', 'DOSE'],
  ['form', 'FORM'],
  ['dosageform', 'FORM'],
  ['route', 'ROUTE'],
  ['administrationroute', 'ROUTE'],
  ['duongdung', 'ROUTE'],
  ['frequency', 'FREQUENCY'],
  ['freq', 'FREQUENCY'],
  ['tansuat', 'FREQUENCY'],
  ['duration', 'DURATION'],
  ['timing', 'TIMING'],
  ['meal', 'TIMING'],
  ['instruction', 'INSTRUCTION'],
  ['directions', 'INSTRUCTION'],
  ['huongdan', 'INSTRUCTION']
]);

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '');
}

export function normalizeLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (['DRUG', 'ACTIVE_INGREDIENT', 'STRENGTH', 'DOSE', 'FORM', 'ROUTE', 'FREQUENCY', 'DURATION', 'TIMING', 'INSTRUCTION'].includes(upper)) {
    return upper;
  }
  return LABEL_MAP.get(normalizeKey(raw)) ?? null;
}

function isFilePath(filePath) {
  return path.extname(filePath).length > 0;
}

export async function walkFiles(root) {
  const rootStats = await stat(root);
  if (rootStats.isFile()) return [root];

  const files = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile()) files.push(fullPath);
    }
  }
  await visit(root);
  return files.sort();
}

function classifyFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (ANNOTATION_EXTENSIONS.has(extension)) return 'annotation_candidate';
  if (['.zip', '.7z', '.rar'].includes(extension)) return 'archive';
  return 'other';
}

async function readStructuredFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jsonl' || extension === '.ndjson') {
    return content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
  }
  if (extension === '.json') return JSON.parse(content);
  return null;
}

function getArray(value) {
  return Array.isArray(value) ? value : null;
}

function sourceFormat(value) {
  if (value && Array.isArray(value.images) && Array.isArray(value.annotations)) return 'coco';
  if (Array.isArray(value) && value.some((item) => Array.isArray(item?.annotations))) return 'label_studio';
  if (value && Array.isArray(value.entities)) return 'medicare_annotation';
  if (Array.isArray(value) && value.some((item) => Array.isArray(item?.entities))) return 'medicare_annotation';
  return 'generic_json';
}

function flattenRecords(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.records)) return value.records;
  if (value && Array.isArray(value.items)) return value.items;
  if (value && Array.isArray(value.data)) return value.data;
  return value && typeof value === 'object' ? [value] : [];
}

function collectEntityLabels(value, labels) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value.entities)) {
    for (const entity of value.entities) {
      const label = normalizeLabel(entity.label ?? entity.category ?? entity.type);
      if (label) labels[label] = (labels[label] ?? 0) + 1;
    }
  }
  if (Array.isArray(value.categories)) {
    for (const category of value.categories) {
      const label = normalizeLabel(category.name ?? category.label);
      if (label) labels[label] = (labels[label] ?? 0) + 1;
    }
  }
  if (Array.isArray(value.annotations)) {
    for (const annotation of value.annotations) {
      for (const result of annotation.result ?? []) {
        for (const label of result.value?.labels ?? result.labels ?? []) {
          const normalized = normalizeLabel(label);
          if (normalized) labels[normalized] = (labels[normalized] ?? 0) + 1;
        }
      }
    }
  }
}

function collectRelationTypes(value, relations) {
  if (!value || typeof value !== 'object') return;
  for (const relation of value.relations ?? []) {
    const type = relation.type ?? relation.labels?.[0] ?? relation.label ?? 'UNSPECIFIED';
    relations[type] = (relations[type] ?? 0) + 1;
  }
  for (const annotation of value.annotations ?? []) {
    for (const relation of annotation.result ?? []) {
      if (relation.type === 'relation') {
        const type = relation.labels?.[0] ?? 'UNSPECIFIED';
        relations[type] = (relations[type] ?? 0) + 1;
      }
    }
  }
}

function collectLikelySensitiveFields(value, found, keyPath = '') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) collectLikelySensitiveFields(item, found, `${keyPath}[${index}]`);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const normalized = normalizeKey(key);
    if (/(patient|fullname|name|dob|birth|phone|address|insurance|diagnos|doctor|physician|hospital|email|idcard|identity)/i.test(normalized)) {
      found.add(keyPath ? `${keyPath}.${key}` : key);
    }
    if (item && typeof item === 'object') collectLikelySensitiveFields(item, found, keyPath ? `${keyPath}.${key}` : key);
  }
}

export async function inspectDataset(inputPath) {
  const files = await walkFiles(inputPath);
  const report = {
    inspected_at: new Date().toISOString(),
    input_path: path.resolve(inputPath),
    totals: { files: files.length, images: 0, annotation_candidates: 0, archives: 0, other: 0 },
    extensions: {},
    annotation_profiles: [],
    entity_label_counts: {},
    relation_type_counts: {},
    likely_sensitive_fields: [],
    warnings: []
  };
  const sensitiveFields = new Set();

  for (const filePath of files) {
    const type = classifyFile(filePath);
    report.totals[type === 'image' ? 'images' : type === 'annotation_candidate' ? 'annotation_candidates' : type === 'archive' ? 'archives' : 'other'] += 1;
    const extension = path.extname(filePath).toLowerCase() || '<none>';
    report.extensions[extension] = (report.extensions[extension] ?? 0) + 1;
    if (type !== 'annotation_candidate' || !['.json', '.jsonl', '.ndjson'].includes(extension)) continue;

    try {
      const parsed = await readStructuredFile(filePath);
      const labels = {};
      const relations = {};
      collectEntityLabels(parsed, labels);
      collectRelationTypes(parsed, relations);
      collectLikelySensitiveFields(parsed, sensitiveFields);
      for (const [label, count] of Object.entries(labels)) report.entity_label_counts[label] = (report.entity_label_counts[label] ?? 0) + count;
      for (const [relation, count] of Object.entries(relations)) report.relation_type_counts[relation] = (report.relation_type_counts[relation] ?? 0) + count;
      report.annotation_profiles.push({
        file: path.relative(inputPath, filePath),
        format: sourceFormat(parsed),
        record_count: flattenRecords(parsed).length,
        top_level_keys: parsed && !Array.isArray(parsed) && typeof parsed === 'object' ? Object.keys(parsed) : [],
        entity_labels: labels,
        relation_types: relations
      });
    } catch (error) {
      report.warnings.push(`Không đọc được ${path.relative(inputPath, filePath)}: ${error.message}`);
    }
  }

  report.likely_sensitive_fields = [...sensitiveFields].sort();
  if (report.totals.annotation_candidates === 0) report.warnings.push('Không tìm thấy file annotation có đuôi được hỗ trợ.');
  if (report.totals.images === 0) report.warnings.push('Không tìm thấy ảnh trong thư mục input.');
  if (report.likely_sensitive_fields.length > 0) report.warnings.push('Có key có khả năng chứa thông tin định danh; cần review thủ công trước khi dùng.');
  return report;
}

function asText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(' ').trim();
  if (typeof value === 'object') return String(value.text ?? value.value ?? '').trim();
  return String(value).trim();
}

function cleanSampleId(value, fallback) {
  const source = asText(value) || fallback;
  const cleaned = source.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function hashId(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function pickImageRef(record) {
  return asText(record?.image ?? record?.image_path ?? record?.file_name ?? record?.filename ?? record?.file ?? record?.data?.image ?? '');
}

function normalizeBbox(value, options = {}) {
  if (Array.isArray(value) && value.length >= 4 && value.every((item) => Number.isFinite(Number(item)))) {
    const numbers = value.slice(0, 4).map(Number);
    return options.xywh ? [numbers[0], numbers[1], numbers[0] + numbers[2], numbers[1] + numbers[3]] : numbers;
  }
  if (!value || typeof value !== 'object') return null;
  const x = Number(value.x ?? value.left);
  const y = Number(value.y ?? value.top);
  const width = Number(value.width ?? value.w);
  const height = Number(value.height ?? value.h);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  const percentage = options.percentage === true;
  const scaleX = percentage && Number.isFinite(options.imageWidth) ? options.imageWidth / 100 : 1;
  const scaleY = percentage && Number.isFinite(options.imageHeight) ? options.imageHeight / 100 : 1;
  return [x * scaleX, y * scaleY, (x + width) * scaleX, (y + height) * scaleY];
}

function makeEntity({ id, label, text, normalizedText, bbox, needsReview = false }) {
  const visibleText = asText(text);
  return {
    id,
    label,
    text: visibleText,
    normalized_text: asText(normalizedText) || visibleText || null,
    bbox,
    needs_review: needsReview || !visibleText || !bbox
  };
}

function makeAnnotation({ sampleId, imageRef, entities, relations, split, notes }) {
  return {
    sample_id: sampleId,
    image: { file_name: imageRef || null, width: null, height: null, difficulty: 'unknown' },
    privacy: { de_identified: false, reviewed: false, removed_fields: [] },
    split: split || null,
    entities,
    relations,
    review: { status: 'draft', annotator_a: null, annotator_b: null, reviewer: null, notes }
  };
}

function convertEntitiesFromMediCare(record, notes) {
  const entities = [];
  const idMap = new Map();
  for (const [index, source] of (record.entities ?? []).entries()) {
    const label = normalizeLabel(source.label ?? source.category ?? source.type);
    if (!label) {
      notes.push(`Bỏ qua entity ${source.id ?? index}: label không được hỗ trợ.`);
      continue;
    }
    const id = `entity_${entities.length + 1}`;
    idMap.set(source.id ?? String(index), id);
    entities.push(makeEntity({
      id,
      label,
      text: source.text ?? source.raw_text,
      normalizedText: source.normalized_text ?? source.normalizedText,
      bbox: normalizeBbox(source.bbox),
      needsReview: source.needs_review === true
    }));
  }
  const relations = [];
  for (const relation of record.relations ?? []) {
    const source = idMap.get(relation.source ?? relation.source_entity_id);
    const target = idMap.get(relation.target ?? relation.target_entity_id);
    if (source && target) relations.push({ source, type: relation.type ?? 'RELATED_TO', target });
    else notes.push('Bỏ qua relation trỏ tới entity không tồn tại.');
  }
  return { entities, relations };
}

function convertFields(record, notes) {
  const entities = [];
  const drugId = { value: null };
  for (const [key, value] of Object.entries(record)) {
    const label = FIELD_MAP.get(normalizeKey(key));
    const text = asText(value);
    if (!label || !text) continue;
    const id = `entity_${entities.length + 1}`;
    entities.push(makeEntity({ id, label, text, bbox: null, needsReview: true }));
    if (label === 'DRUG') drugId.value = id;
  }
  const relations = [];
  if (drugId.value) {
    for (const entity of entities) {
      if (entity.id === drugId.value) continue;
      relations.push({ source: drugId.value, type: `HAS_${entity.label}`, target: entity.id });
    }
  }
  if (entities.length === 0) notes.push('Không tìm thấy field thuốc/điều trị tương thích để chuyển đổi.');
  return { entities, relations };
}

function convertLabelStudioTask(task, notes) {
  const entities = [];
  const resultIdMap = new Map();
  const annotation = task.annotations?.[0] ?? task;
  const results = annotation.result ?? [];
  for (const [index, result] of results.entries()) {
    const label = normalizeLabel(result.value?.labels?.[0] ?? result.value?.label?.[0] ?? result.label);
    if (!label || result.type === 'relation') continue;
    const value = result.value ?? {};
    const text = asText(value.text ?? result.text ?? '');
    const imageWidth = Number(result.original_width ?? result.value?.original_width ?? task.meta?.width);
    const imageHeight = Number(result.original_height ?? result.value?.original_height ?? task.meta?.height);
    const bbox = normalizeBbox(value, { percentage: true, imageWidth, imageHeight });
    const id = `entity_${entities.length + 1}`;
    resultIdMap.set(result.id ?? String(index), id);
    entities.push(makeEntity({ id, label, text, bbox, needsReview: !text || !bbox }));
  }
  const relations = [];
  for (const result of results.filter((item) => item.type === 'relation')) {
    const source = resultIdMap.get(result.from_id ?? result.from);
    const target = resultIdMap.get(result.to_id ?? result.to);
    if (source && target) relations.push({ source, type: result.labels?.[0] ?? 'RELATED_TO', target });
    else notes.push('Label Studio relation không ghép được với entity tương ứng.');
  }
  return { entities, relations };
}

function convertCoco(data, sourceFile, notes) {
  const categories = new Map((data.categories ?? []).map((category) => [category.id, normalizeLabel(category.name)]));
  const images = new Map((data.images ?? []).map((image) => [image.id, image]));
  const grouped = new Map();
  for (const annotation of data.annotations ?? []) {
    const image = images.get(annotation.image_id);
    if (!image) continue;
    const sampleKey = String(image.id);
    const group = grouped.get(sampleKey) ?? { image, entities: [], relations: [], notes: [] };
    const label = categories.get(annotation.category_id);
    if (!label) {
      group.notes.push(`COCO category ${annotation.category_id} không map được sang MediCare label.`);
      grouped.set(sampleKey, group);
      continue;
    }
    group.entities.push(makeEntity({
      id: `entity_${group.entities.length + 1}`,
      label,
      text: annotation.text ?? annotation.transcription ?? '',
      normalizedText: annotation.normalized_text,
      bbox: normalizeBbox(annotation.bbox, { xywh: true }),
      needsReview: true
    }));
    grouped.set(sampleKey, group);
  }
  return [...grouped.values()].map((group, index) => ({
    annotation: makeAnnotation({
      sampleId: cleanSampleId(group.image.file_name ?? group.image.id, `${path.basename(sourceFile)}_${index + 1}`),
      imageRef: group.image.file_name ?? '',
      entities: group.entities,
      relations: group.relations,
      split: null,
      notes: [...group.notes, 'COCO import: cần review text/entity và quan hệ thuốc–trường.']
    }),
    source_record: group.image.id
  }));
}

function convertRecord(record, sourceFile, index) {
  const notes = [`Imported from ${path.basename(sourceFile)}; chưa xác nhận quyền sử dụng.`];
  if (record && Array.isArray(record.entities)) {
    const converted = convertEntitiesFromMediCare(record, notes);
    return makeAnnotation({ sampleId: cleanSampleId(record.sample_id ?? record.id, `${path.basename(sourceFile)}_${index + 1}`), imageRef: pickImageRef(record), entities: converted.entities, relations: converted.relations, split: record.split, notes });
  }
  if (record && Array.isArray(record.annotations)) {
    const converted = convertLabelStudioTask(record, notes);
    return makeAnnotation({ sampleId: cleanSampleId(record.id ?? pickImageRef(record), `${path.basename(sourceFile)}_${index + 1}`), imageRef: pickImageRef(record), entities: converted.entities, relations: converted.relations, split: record.split, notes });
  }
  const converted = convertFields(record ?? {}, notes);
  return makeAnnotation({ sampleId: cleanSampleId(record?.sample_id ?? record?.id ?? pickImageRef(record), `${path.basename(sourceFile)}_${index + 1}`), imageRef: pickImageRef(record), entities: converted.entities, relations: converted.relations, split: record?.split, notes });
}

async function readRecords(filePath) {
  const parsed = await readStructuredFile(filePath);
  if (parsed === null) return [];
  if (parsed && Array.isArray(parsed.images) && Array.isArray(parsed.annotations)) return { coco: parsed };
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.records)) return parsed.records;
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  return [parsed];
}

export async function convertDataset(inputPath, outputPath) {
  const files = (await walkFiles(inputPath)).filter((filePath) => ['.json', '.jsonl', '.ndjson'].includes(path.extname(filePath).toLowerCase()));
  await mkdir(outputPath, { recursive: true });
  const usedIds = new Set();
  const manifest = {
    converted_at: new Date().toISOString(),
    input_path: path.resolve(inputPath),
    output_path: path.resolve(outputPath),
    source_status: 'unverified',
    source_license: 'Unknown',
    files_scanned: files.length,
    annotations_written: 0,
    entities_written: 0,
    relations_written: 0,
    skipped_files: [],
    warnings: []
  };

  for (const sourceFile of files) {
    try {
      const records = await readRecords(sourceFile);
      let convertedItems = [];
      if (records?.coco) convertedItems = convertCoco(records.coco, sourceFile, manifest.warnings);
      else if (records?.length && records.some((record) => Array.isArray(record?.annotations))) {
        convertedItems = records.map((record, index) => ({ annotation: convertRecord(record, sourceFile, index) }));
      } else {
        convertedItems = (records ?? []).map((record, index) => ({ annotation: convertRecord(record, sourceFile, index) }));
      }
      for (const [index, item] of convertedItems.entries()) {
        const annotation = item.annotation;
        let sampleId = annotation.sample_id;
        if (usedIds.has(sampleId)) sampleId = `${sampleId}_${hashId(`${sourceFile}:${index}`)}`;
        usedIds.add(sampleId);
        annotation.sample_id = sampleId;
        const outputFile = path.join(outputPath, `${sampleId}.json`);
        await writeFile(outputFile, `${JSON.stringify(annotation, null, 2)}\n`, 'utf8');
        manifest.annotations_written += 1;
        manifest.entities_written += annotation.entities.length;
        manifest.relations_written += annotation.relations.length;
      }
    } catch (error) {
      manifest.skipped_files.push(path.relative(inputPath, sourceFile));
      manifest.warnings.push(`Bỏ qua ${path.relative(inputPath, sourceFile)}: ${error.message}`);
    }
  }
  await writeFile(path.join(outputPath, 'conversion-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export function reportToMarkdown(report) {
  const lines = [
    '# VAIPE-P dataset inspection report',
    '',
    `- Input: \`${report.input_path}\``,
    `- Inspected at: ${report.inspected_at}`,
    `- Files: ${report.totals.files}`,
    `- Images: ${report.totals.images}`,
    `- Annotation candidates: ${report.totals.annotation_candidates}`,
    `- Archives: ${report.totals.archives}`,
    '',
    '## Entity labels',
    '',
    ...Object.entries(report.entity_label_counts).map(([label, count]) => `- ${label}: ${count}`),
    ...(Object.keys(report.entity_label_counts).length === 0 ? ['- Chưa phát hiện nhãn MediCare tương thích.'] : []),
    '',
    '## Relations',
    '',
    ...Object.entries(report.relation_type_counts).map(([relation, count]) => `- ${relation}: ${count}`),
    ...(Object.keys(report.relation_type_counts).length === 0 ? ['- Chưa phát hiện relation.'] : []),
    '',
    '## Annotation profiles',
    '',
    ...report.annotation_profiles.map((profile) => `- \`${profile.file}\`: ${profile.format}, ${profile.record_count} record(s)`),
    '',
    '## Warnings',
    '',
    ...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ['- Không có cảnh báo tự động.']),
    '',
    '## Privacy review',
    '',
    ...(report.likely_sensitive_fields.length ? report.likely_sensitive_fields.map((field) => `- Có key cần review: \`${field}\``) : ['- Không phát hiện key nhạy cảm theo heuristic; vẫn phải review thủ công.'])
  ];
  return `${lines.join('\n')}\n`;
}
