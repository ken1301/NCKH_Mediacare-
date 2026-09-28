import { extractDrugNameAndStrength } from '../catalog/drug-catalog.mjs';

const TIMING_PATTERN = /\b(sáng|trưa|chiều|tối|đêm|sang|trua|chieu|toi|dem)\b/i;
const DOSE_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(viên|vien|v|gói|goi|ống|ong|ml|mg|g|thìa|thia|nhát|nhat|giọt|giot)\b/i;
const MEAL_TIMING_PATTERN = /uống\s+(sau|trước)\s+khi\s+ăn/i;
const QUANTITY_PATTERN = /\bSL\s*:\s*(\d+(?:[.,]\d+)?)\s*([^,;]+)/i;

function top(box) {
  return Array.isArray(box) && box.length >= 4 ? Number(box[1]) : Number.POSITIVE_INFINITY;
}

function bottom(box) {
  return Array.isArray(box) && box.length >= 4 ? Number(box[3]) : Number.NEGATIVE_INFINITY;
}

function centerY(box) {
  return (top(box) + bottom(box)) / 2;
}

function normalizeUnit(unit) {
  const normalized = String(unit ?? '').normalize('NFKC').toLowerCase();
  if (['v', 'vien'].includes(normalized)) return 'viên';
  if (['goi'].includes(normalized)) return 'gói';
  if (['ong'].includes(normalized)) return 'ống';
  if (['thia'].includes(normalized)) return 'thìa';
  if (['nhat'].includes(normalized)) return 'nhát';
  if (['giot'].includes(normalized)) return 'giọt';
  return normalized;
}

function uniqueStrengths(strengths) {
  const seen = new Set();
  return strengths.filter((strength) => {
    const key = strength.toLowerCase().replace(',', '.').replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nearestDrug(source, drugWords) {
  if (drugWords.length === 0) return null;
  const sourceY = centerY(source.box);
  return [...drugWords]
    .sort((left, right) => Math.abs(centerY(left.box) - sourceY) - Math.abs(centerY(right.box) - sourceY))[0] ?? null;
}

function addEntity(entities, label, text, sourceWord, drugId, reason) {
  if (!text || !sourceWord) return null;
  const entity = {
    id: `candidate_entity_${entities.length + 1}`,
    label,
    text: String(text).trim(),
    bbox: sourceWord.box,
    source_word_id: sourceWord.id ?? null,
    source_label: sourceWord.label ?? null,
    source_drug_entity_id: drugId,
    needs_review: true,
    candidate_reason: reason
  };
  entities.push(entity);
  return entity;
}

function addRelation(relations, type, drugId, targetId, reason) {
  if (!drugId || !targetId) return;
  relations.push({
    id: `candidate_relation_${relations.length + 1}`,
    type,
    source_entity_id: drugId,
    target_entity_id: targetId,
    needs_review: true,
    candidate_reason: reason
  });
}

function parseQuantity(text) {
  const match = String(text ?? '').match(QUANTITY_PATTERN);
  if (!match) return null;
  return { value: Number(match[1].replace(',', '.')), unit: normalizeUnit(match[2].trim()), text: match[0] };
}

export function buildMedicationAnnotationCandidate(record, sourceFile = null) {
  const words = Array.isArray(record) ? record : [];
  const drugWords = words.filter((word) => word?.label === 'drugname');
  const entities = [];
  const relations = [];
  const totalQuantityCandidates = [];
  const warnings = [
    'candidate_only: không phải gold annotation.',
    'Tất cả entity/relation cần annotator xác nhận trên ảnh.',
    'Bbox của field tách từ drugname/usage đang dùng lại bbox nguồn và phải được tinh chỉnh.'
  ];
  const drugIds = new Map();

  for (const drugWord of drugWords) {
    const parsed = extractDrugNameAndStrength(drugWord.text);
    const drug = addEntity(entities, 'DRUG', parsed.drug_name, drugWord, null, 'drugname source label');
    if (!drug) continue;
    drugIds.set(drugWord.id, drug.id);
    for (const strengthText of uniqueStrengths(parsed.strengths)) {
      const strength = addEntity(entities, 'STRENGTH', strengthText, drugWord, drug.id, 'regex extraction from drugname');
      addRelation(relations, 'HAS_STRENGTH', drug.id, strength?.id, 'same source word as drugname; requires span review');
    }
  }

  for (const word of words.filter((item) => item?.label === 'quantity')) {
    const quantity = parseQuantity(word.text);
    if (!quantity) continue;
    const drugWord = nearestDrug(word, drugWords);
    totalQuantityCandidates.push({
      ...quantity,
      source_word_id: word.id ?? null,
      source_drug_word_id: drugWord?.id ?? null,
      needs_review: true
    });
  }

  const instructionWords = words.filter((word) => {
    if (word?.label === 'usage') return true;
    return word?.label === 'other' && MEAL_TIMING_PATTERN.test(String(word.text ?? ''));
  });
  for (const word of instructionWords) {
    const drugWord = nearestDrug(word, drugWords);
    const drugId = drugIds.get(drugWord?.id);
    if (!drugId) {
      warnings.push(`Không ghép được instruction source word ${word.id ?? 'unknown'} với DRUG.`);
      continue;
    }
    const text = String(word.text ?? '');
    const timingMatch = text.match(TIMING_PATTERN);
    if (timingMatch) {
      const timing = addEntity(entities, 'TIMING', timingMatch[1], word, drugId, 'timing keyword from usage/instruction');
      addRelation(relations, 'HAS_TIMING', drugId, timing?.id, 'nearest drug by vertical layout; requires review');
    }
    const doseMatch = text.match(DOSE_PATTERN);
    if (doseMatch) {
      const dose = addEntity(entities, 'DOSE', `${doseMatch[1]} ${normalizeUnit(doseMatch[2])}`, word, drugId, 'dose pattern from usage');
      addRelation(relations, 'HAS_DOSE', drugId, dose?.id, 'nearest drug by vertical layout; requires review');
    }
    const mealTiming = text.match(MEAL_TIMING_PATTERN);
    if (mealTiming) {
      const instruction = addEntity(entities, 'INSTRUCTION', text.replace(/^Ghi chú\s*/i, '').trim(), word, drugId, 'meal instruction from other source label');
      addRelation(relations, 'HAS_INSTRUCTION', drugId, instruction?.id, 'nearest drug by vertical layout; requires review');
    }
  }

  return {
    candidate_version: 'medication.annotation.candidate.v1',
    sample_id: words.sample_id ?? null,
    source_file: sourceFile,
    status: 'candidate_only',
    annotation_status: 'needs_review',
    privacy: { reviewed: false, approved_for_research: false },
    candidate_entities: entities,
    candidate_relations: relations,
    total_quantity_candidates: totalQuantityCandidates,
    warnings
  };
}
