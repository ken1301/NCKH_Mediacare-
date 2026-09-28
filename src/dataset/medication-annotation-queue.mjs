const MEDICATION_LABELS = [
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

function annotationStatus(record) {
  if (typeof record?.annotation_status === 'string') return record.annotation_status;
  if (record?.review?.status === 'complete') return 'complete';
  if (record?.review?.status === 'draft') return 'partial';
  return 'needs_review';
}

function entityCounts(entities) {
  return Object.fromEntries(MEDICATION_LABELS.map((label) => [
    label,
    entities.filter((entity) => entity?.label === label).length
  ]));
}

export function createAnnotationQueueItem(record, sourceFile = null) {
  const entities = Array.isArray(record?.entities) ? record.entities : [];
  const relations = Array.isArray(record?.relations) ? record.relations : [];
  const counts = entityCounts(entities);
  const actions = [
    'review_privacy_and_de_identification',
    'verify_entity_spans_against_image',
    'annotate_medication_relations_after_entity_review',
    'adjudicate_before_marking_complete'
  ];
  if (counts.INSTRUCTION > 0) actions.splice(2, 0, 'split_instruction_into_typed_medication_fields');
  if (relations.length > 0) actions.push('verify_existing_relations');

  return {
    sample_id: record?.sample_id ?? null,
    source_file: sourceFile,
    image_file: record?.image?.file_name ?? null,
    split: record?.split ?? null,
    current_annotation_status: annotationStatus(record),
    privacy: {
      de_identified: record?.privacy?.de_identified === true,
      reviewed: record?.privacy?.reviewed === true,
      approved_for_research: record?.privacy?.approved_for_research === true
    },
    entity_counts: counts,
    existing_relation_count: relations.length,
    actions
  };
}

export function buildAnnotationQueue(records, options = {}) {
  const sourceFiles = options.sourceFiles ?? [];
  const items = (records ?? []).map((record, index) => createAnnotationQueueItem(record, sourceFiles[index] ?? null));
  return {
    queue_version: 'medication.annotation.queue.v1',
    generated_at: options.generatedAt ?? new Date().toISOString(),
    purpose: 'manual_review_and_medication_relation_annotation',
    policy: {
      creates_gold_relations: false,
      creates_metrics: false,
      includes_raw_text: false,
      requires_human_privacy_review: true,
      requires_two_annotators_and_adjudication: true,
      complete_requires_at_least_one_medication_relation: true
    },
    total_items: items.length,
    items
  };
}
