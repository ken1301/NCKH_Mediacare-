const LABELS = new Set([
  'DRUG',
  'STRENGTH',
  'DOSE',
  'FORM',
  'ROUTE',
  'FREQUENCY',
  'DURATION',
  'TIMING',
  'INSTRUCTION'
]);

function numericBox(box) {
  return Array.isArray(box) && box.length === 4 ? box.map(Number) : null;
}

function boxArea(box) {
  const [x1, y1, x2, y2] = box;
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

function boxIoU(first, second) {
  const a = numericBox(first);
  const b = numericBox(second);
  if (!a || !b || [...a, ...b].some((value) => !Number.isFinite(value))) return 0;
  const intersection = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
    * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const union = boxArea(a) + boxArea(b) - intersection;
  return union > 0 ? intersection / union : 0;
}

function boxOverlapCoverage(first, second) {
  const a = numericBox(first);
  const b = numericBox(second);
  if (!a || !b || [...a, ...b].some((value) => !Number.isFinite(value))) return 0;
  const intersection = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]))
    * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const smallerArea = Math.min(boxArea(a), boxArea(b));
  return smallerArea > 0 ? intersection / smallerArea : 0;
}

function sortSpatial(words) {
  return [...words].sort((left, right) => {
    const leftBox = numericBox(left.bbox ?? left.box) ?? [0, 0, 0, 0];
    const rightBox = numericBox(right.bbox ?? right.box) ?? [0, 0, 0, 0];
    const leftCenter = (leftBox[1] + leftBox[3]) / 2;
    const rightCenter = (rightBox[1] + rightBox[3]) / 2;
    const rowTolerance = Math.max(leftBox[3] - leftBox[1], rightBox[3] - rightBox[1], 1) * 0.5;
    return Math.abs(leftCenter - rightCenter) <= rowTolerance
      ? leftBox[0] - rightBox[0]
      : leftCenter - rightCenter;
  });
}

export function wordsToBio(words, entities, { iouThreshold = 0.5 } = {}) {
  const sortedWords = sortSpatial(Array.isArray(words) ? words : []);
  const usableEntities = (Array.isArray(entities) ? entities : [])
    .filter((entity) => LABELS.has(entity.label) && numericBox(entity.bbox));
  const lastEntityId = { value: null };
  const matchedEntityIds = new Set();
  const tokens = sortedWords.map((word, index) => {
    const candidates = usableEntities
      .map((entity) => ({
        entity,
        score: Math.max(
          boxIoU(word.bbox ?? word.box, entity.bbox),
          boxOverlapCoverage(word.bbox ?? word.box, entity.bbox)
        )
      }))
      .filter((candidate) => candidate.score >= iouThreshold)
      .sort((left, right) => right.score - left.score);
    const match = candidates[0]?.entity ?? null;
    if (!match) {
      lastEntityId.value = null;
      return {
        token_id: word.id ?? `token_${index + 1}`,
        text: String(word.text ?? ''),
        bbox: word.bbox ?? word.box ?? null,
        entity_id: null,
        tag: 'O'
      };
    }
    matchedEntityIds.add(match.id);
    const tag = lastEntityId.value === match.id ? `I-${match.label}` : `B-${match.label}`;
    lastEntityId.value = match.id;
    return {
      token_id: word.id ?? `token_${index + 1}`,
      text: String(word.text ?? ''),
      bbox: word.bbox ?? word.box ?? null,
      entity_id: match.id,
      tag
    };
  });
  return {
    tokens,
    unmatched_entity_ids: usableEntities.filter((entity) => !matchedEntityIds.has(entity.id)).map((entity) => entity.id)
  };
}

function relationKey(relation) {
  return `${relation.type}|${relation.source_entity_id ?? relation.source}|${relation.target_entity_id ?? relation.target}`;
}

function metric(precision, recall) {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

export function evaluateRelations(goldRelations, predictedRelations) {
  const gold = new Set((Array.isArray(goldRelations) ? goldRelations : []).map(relationKey));
  const predicted = new Set((Array.isArray(predictedRelations) ? predictedRelations : []).map(relationKey));
  const truePositive = [...predicted].filter((key) => gold.has(key)).length;
  const falsePositive = [...predicted].filter((key) => !gold.has(key)).length;
  const falseNegative = [...gold].filter((key) => !predicted.has(key)).length;
  const precision = predicted.size === 0 ? (gold.size === 0 ? 1 : 0) : truePositive / predicted.size;
  const recall = gold.size === 0 ? (predicted.size === 0 ? 1 : 0) : truePositive / gold.size;
  const byType = {};
  const types = new Set([
    ...(Array.isArray(goldRelations) ? goldRelations : []).map((relation) => relation.type),
    ...(Array.isArray(predictedRelations) ? predictedRelations : []).map((relation) => relation.type)
  ]);
  for (const type of types) {
    const goldOfType = [...gold].filter((key) => key.startsWith(`${type}|`));
    const predictedOfType = [...predicted].filter((key) => key.startsWith(`${type}|`));
    const tp = predictedOfType.filter((key) => gold.has(key)).length;
    const p = predictedOfType.length === 0 ? (goldOfType.length === 0 ? 1 : 0) : tp / predictedOfType.length;
    const r = goldOfType.length === 0 ? (predictedOfType.length === 0 ? 1 : 0) : tp / goldOfType.length;
    byType[type] = { gold: goldOfType.length, predicted: predictedOfType.length, true_positive: tp, precision: p, recall: r, f1: metric(p, r) };
  }
  return {
    gold_count: gold.size,
    predicted_count: predicted.size,
    true_positive: truePositive,
    false_positive: falsePositive,
    false_negative: falseNegative,
    precision,
    recall,
    f1: metric(precision, recall),
    by_type: byType
  };
}

export function annotationToBioExample(annotation, words, options = {}) {
  const result = wordsToBio(words, annotation?.entities, options);
  return {
    sample_id: annotation?.sample_id ?? null,
    schema_version: 'medication.bio.v1',
    token_source: 'ocr_words',
    tokens: result.tokens,
    relations: annotation?.relations ?? [],
    unmatched_entity_ids: result.unmatched_entity_ids,
    ready_for_training: result.unmatched_entity_ids.length === 0 && Array.isArray(words) && words.length > 0
  };
}
