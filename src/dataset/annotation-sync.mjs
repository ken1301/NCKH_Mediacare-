import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateMedicationAnnotation } from './medication-annotation.mjs';

export const ANNOTATOR_IDS = ['annotator-a', 'annotator-b', 'reviewer'];
export const ANNOTATION_BUNDLE_SCHEMA = 'medicare.annotation.bundle.v1';

function isJsonFile(file) {
  return file.toLowerCase().endsWith('.json') && file !== 'manifest.json';
}

function safeSampleId(value) {
  const result = String(value ?? '');
  if (!/^[A-Za-z0-9_.-]+$/.test(result)) throw new Error(`sample_id không hợp lệ: ${result}`);
  return result;
}

async function isDirectory(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export function entityFingerprint(entity) {
  return [
    entity?.label ?? '',
    String(entity?.text ?? '').trim().replace(/\s+/g, ' '),
    ...(Array.isArray(entity?.bbox) ? entity.bbox.map(Number) : [])
  ].join('|');
}

export function annotationFingerprint(record) {
  const entities = (record?.entities ?? []).map(entityFingerprint).sort();
  const entityKeys = new Map((record?.entities ?? []).map((entity) => [entity.id, entityFingerprint(entity)]));
  const relations = (record?.relations ?? [])
    .map((relation) => [
      relation.type ?? '',
      entityKeys.get(relation.source_entity_id) ?? `missing:${relation.source_entity_id ?? ''}`,
      entityKeys.get(relation.target_entity_id) ?? `missing:${relation.target_entity_id ?? ''}`
    ].join('|'))
    .sort();
  return JSON.stringify({
    entities,
    relations,
    annotation_status: record?.annotation_status ?? null,
    privacy: {
      de_identified: record?.privacy?.de_identified === true,
      reviewed: record?.privacy?.reviewed === true,
      approved_for_research: record?.privacy?.approved_for_research === true
    }
  });
}

export function isGoldEligible(record) {
  const validation = validateMedicationAnnotation(record);
  const allReviewed = (record?.entities ?? []).every((entity) => entity.needs_review !== true)
    && (record?.relations ?? []).every((relation) => relation.needs_review !== true);
  const eligible = validation.valid
    && record.annotation_status === 'complete'
    && record.privacy?.de_identified === true
    && record.privacy?.reviewed === true
    && record.privacy?.approved_for_research === true
    && Array.isArray(record.relations)
    && record.relations.length > 0
    && allReviewed;
  return { eligible, validation, allReviewed };
}

async function readRecords(folder, { role = null } = {}) {
  if (!(await isDirectory(folder))) return [];
  const files = (await readdir(folder)).filter(isJsonFile).sort();
  const records = [];
  for (const file of files) {
    const filePath = path.join(folder, file);
    const record = JSON.parse(await readFile(filePath, 'utf8'));
    const sampleId = safeSampleId(record.sample_id);
    records.push({ file, filePath, sample_id: sampleId, record, role });
  }
  return records;
}

export async function exportAnnotationBundle({ input, output, annotator, repositoryCommit = null }) {
  if (!ANNOTATOR_IDS.includes(annotator)) throw new Error(`annotator không hợp lệ: ${annotator}`);
  const records = await readRecords(input, { role: annotator });
  if (records.length === 0) throw new Error(`Không tìm thấy annotation JSON trong ${input}`);

  const invalid = records.map((item) => ({ ...item, validation: validateMedicationAnnotation(item.record) }))
    .filter((item) => !item.validation.valid);
  if (invalid.length > 0) {
    throw new Error(`Có ${invalid.length} annotation không hợp lệ; hãy sửa trước khi export.`);
  }

  await mkdir(output, { recursive: true });
  const files = [];
  for (const item of records) {
    const destination = path.join(output, `${item.sample_id}.json`);
    await writeFile(destination, `${JSON.stringify(item.record, null, 2)}\n`, 'utf8');
    files.push({
      file: `${item.sample_id}.json`,
      sample_id: item.sample_id,
      sha256: await sha256(destination),
      annotation_status: item.record.annotation_status
    });
  }
  const manifest = {
    schema_version: ANNOTATION_BUNDLE_SCHEMA,
    generated_at: new Date().toISOString(),
    annotator,
    repository_commit: repositoryCommit,
    source_directory: path.resolve(input),
    records: files
  };
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { annotator, records: files.length, output, manifest };
}

export async function importAnnotationBundles({ input, output }) {
  const imported = [];
  const invalid = [];
  for (const annotator of ANNOTATOR_IDS) {
    const source = path.join(input, annotator);
    const records = await readRecords(source, { role: annotator });
    if (records.length === 0) continue;
    const destination = path.join(output, annotator);
    await mkdir(destination, { recursive: true });
    for (const item of records) {
      const validation = validateMedicationAnnotation(item.record);
      if (!validation.valid) {
        invalid.push({ annotator, file: item.file, errors: validation.errors });
        continue;
      }
      await writeFile(path.join(destination, `${item.sample_id}.json`), `${JSON.stringify(item.record, null, 2)}\n`, 'utf8');
      imported.push({ annotator, sample_id: item.sample_id });
    }
  }
  return { imported, invalid, input, output };
}

export async function mergeAnnotationBundles({ input, goldOutput, reportOutput }) {
  const bySample = new Map();
  const invalid = [];
  let sourceRecords = 0;
  for (const annotator of ANNOTATOR_IDS) {
    const records = await readRecords(path.join(input, annotator), { role: annotator });
    for (const item of records) {
      sourceRecords += 1;
      const validation = validateMedicationAnnotation(item.record);
      if (!validation.valid) {
        invalid.push({ annotator, file: item.file, sample_id: item.sample_id, errors: validation.errors });
        continue;
      }
      if (!bySample.has(item.sample_id)) bySample.set(item.sample_id, new Map());
      bySample.get(item.sample_id).set(annotator, item.record);
    }
  }

  await mkdir(path.dirname(reportOutput), { recursive: true });
  const sampleReports = [];
  let agreements = 0;
  let conflicts = 0;
  let reviewerReady = 0;
  let goldWritten = 0;

  for (const [sampleId, contributors] of [...bySample.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const annotatorA = contributors.get('annotator-a');
    const annotatorB = contributors.get('annotator-b');
    const reviewer = contributors.get('reviewer');
    let agreement = 'not_comparable';
    if (annotatorA && annotatorB) {
      agreement = annotationFingerprint(annotatorA) === annotationFingerprint(annotatorB) ? 'agree' : 'conflict';
      if (agreement === 'agree') agreements += 1;
      else conflicts += 1;
    }

    const eligibility = reviewer ? isGoldEligible(reviewer) : { eligible: false, validation: null, allReviewed: false };
    if (eligibility.eligible) {
      reviewerReady += 1;
      await mkdir(goldOutput, { recursive: true });
      await writeFile(path.join(goldOutput, `${safeSampleId(sampleId)}.json`), `${JSON.stringify(reviewer, null, 2)}\n`, 'utf8');
      goldWritten += 1;
    }

    sampleReports.push({
      sample_id: sampleId,
      contributors: [...contributors.keys()],
      annotator_agreement: agreement,
      reviewer: reviewer ? {
        gold_eligible: eligibility.eligible,
        all_entities_and_relations_reviewed: eligibility.allReviewed,
        annotation_status: reviewer.annotation_status,
        privacy: reviewer.privacy
      } : null,
      gold_status: eligibility.eligible ? 'written' : 'not_written'
    });
  }

  const report = {
    schema_version: ANNOTATION_BUNDLE_SCHEMA,
    generated_at: new Date().toISOString(),
    input: path.resolve(input),
    gold_output: path.resolve(goldOutput),
    policy: {
      gold_source: 'reviewer only',
      require_complete: true,
      require_de_identified: true,
      require_privacy_review: true,
      require_approved_for_research: true,
      require_all_entities_and_relations_reviewed: true,
      require_at_least_one_relation: true,
      annotator_conflict_is_reported_but_never_auto_resolved: true
    },
    summary: {
      samples: bySample.size,
      source_records: sourceRecords,
      valid_records: sourceRecords - invalid.length,
      invalid_records: invalid.length,
      agreements,
      conflicts,
      reviewer_ready: reviewerReady,
      gold_written: goldWritten
    },
    invalid,
    samples: sampleReports
  };
  await writeFile(reportOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}
