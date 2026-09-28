export const MEDICATION_ENTITY_LABELS = [
  'DRUG',
  'STRENGTH',
  'DOSE',
  'FORM',
  'ROUTE',
  'FREQUENCY',
  'DURATION',
  'TIMING',
  'INSTRUCTION'
];

export const MEDICATION_RELATION_TYPES = [
  'HAS_STRENGTH',
  'HAS_DOSE',
  'HAS_FORM',
  'HAS_ROUTE',
  'HAS_FREQUENCY',
  'HAS_DURATION',
  'HAS_TIMING',
  'HAS_INSTRUCTION'
];

const RELATION_TARGET_LABEL = Object.fromEntries(
  MEDICATION_RELATION_TYPES.map((type) => [type, type.replace('HAS_', '')])
);

function isFiniteBox(box) {
  return Array.isArray(box)
    && box.length === 4
    && box.every((value) => Number.isFinite(Number(value)))
    && Number(box[2]) > Number(box[0])
    && Number(box[3]) > Number(box[1]);
}

export function validateMedicationAnnotation(record) {
  const errors = [];
  const warnings = [];
  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['record must be an object'], warnings };
  }
  if (typeof record.sample_id !== 'string' || record.sample_id.trim() === '') errors.push('sample_id is required');
  if (!Array.isArray(record.entities)) errors.push('entities must be an array');
  if (!Array.isArray(record.relations)) errors.push('relations must be an array');
  if (!['partial', 'complete', 'needs_review'].includes(record.annotation_status)) {
    errors.push('annotation_status must be partial, complete, or needs_review');
  }

  const entities = Array.isArray(record.entities) ? record.entities : [];
  const relations = Array.isArray(record.relations) ? record.relations : [];
  const ids = new Set();
  const entitiesById = new Map();
  for (const [index, entity] of entities.entries()) {
    if (!entity || typeof entity !== 'object') {
      errors.push(`entities[${index}] must be an object`);
      continue;
    }
    if (typeof entity.id !== 'string' || entity.id.trim() === '') errors.push(`entities[${index}].id is required`);
    if (ids.has(entity.id)) errors.push(`duplicate entity id: ${entity.id}`);
    ids.add(entity.id);
    entitiesById.set(entity.id, entity);
    if (!MEDICATION_ENTITY_LABELS.includes(entity.label)) errors.push(`invalid entity label: ${entity.label}`);
    if (typeof entity.text !== 'string' || entity.text.trim() === '') errors.push(`entities[${index}].text is required`);
    if (!isFiniteBox(entity.bbox)) errors.push(`entities[${index}].bbox is invalid`);
  }

  const relationIds = new Set();
  for (const [index, relation] of relations.entries()) {
    if (!relation || typeof relation !== 'object') {
      errors.push(`relations[${index}] must be an object`);
      continue;
    }
    if (typeof relation.id !== 'string' || relation.id.trim() === '') errors.push(`relations[${index}].id is required`);
    if (relationIds.has(relation.id)) errors.push(`duplicate relation id: ${relation.id}`);
    relationIds.add(relation.id);
    if (!MEDICATION_RELATION_TYPES.includes(relation.type)) errors.push(`invalid relation type: ${relation.type}`);
    const source = entitiesById.get(relation.source_entity_id);
    const target = entitiesById.get(relation.target_entity_id);
    if (!source) errors.push(`relation ${relation.id} references missing source entity`);
    if (!target) errors.push(`relation ${relation.id} references missing target entity`);
    if (source && source.label !== 'DRUG') errors.push(`relation ${relation.id} source must be DRUG`);
    if (target && relation.type && target.label !== RELATION_TARGET_LABEL[relation.type]) {
      errors.push(`relation ${relation.id} target label must be ${RELATION_TARGET_LABEL[relation.type]}`);
    }
  }

  if (relations.length === 0) warnings.push('no medication relations; relation extraction cannot be evaluated');
  if (!entities.some((entity) => entity.label === 'DRUG')) warnings.push('no DRUG entity');
  if (record.annotation_status === 'complete' && relations.length === 0) {
    errors.push('complete annotation requires at least one medication relation');
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function summarizeMedicationAnnotations(records) {
  const summary = {
    samples: 0,
    valid_samples: 0,
    invalid_samples: 0,
    complete_samples: 0,
    partial_samples: 0,
    needs_review_samples: 0,
    entities: 0,
    entities_by_label: Object.fromEntries(MEDICATION_ENTITY_LABELS.map((label) => [label, 0])),
    relations: 0,
    relations_by_type: Object.fromEntries(MEDICATION_RELATION_TYPES.map((type) => [type, 0])),
    warnings: 0,
    errors: 0,
    invalid_sample_ids: []
  };
  for (const record of records ?? []) {
    summary.samples += 1;
    const result = validateMedicationAnnotation(record);
    if (result.valid) summary.valid_samples += 1;
    else {
      summary.invalid_samples += 1;
      if (typeof record?.sample_id === 'string') summary.invalid_sample_ids.push(record.sample_id);
    }
    summary.errors += result.errors.length;
    summary.warnings += result.warnings.length;
    if (record?.annotation_status === 'complete') summary.complete_samples += 1;
    if (record?.annotation_status === 'partial') summary.partial_samples += 1;
    if (record?.annotation_status === 'needs_review') summary.needs_review_samples += 1;
    for (const entity of record?.entities ?? []) {
      summary.entities += 1;
      if (entity.label in summary.entities_by_label) summary.entities_by_label[entity.label] += 1;
    }
    for (const relation of record?.relations ?? []) {
      summary.relations += 1;
      if (relation.type in summary.relations_by_type) summary.relations_by_type[relation.type] += 1;
    }
  }
  return summary;
}
