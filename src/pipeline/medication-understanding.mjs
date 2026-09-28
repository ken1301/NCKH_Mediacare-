import { extractDrugNameAndStrength, linkDrug } from '../catalog/drug-catalog.mjs';

function centerY(box) {
  return (Number(box?.[1] ?? 0) + Number(box?.[3] ?? 0)) / 2;
}

function boxHeight(box) {
  return Math.max(1, Number(box?.[3] ?? 0) - Number(box?.[1] ?? 0));
}

export function groupOcrWordsIntoLines(words) {
  const lines = [];
  for (const word of [...(words ?? [])]
    .filter((item) => item?.text && Array.isArray(item.bbox))
    .sort((left, right) => centerY(left.bbox) - centerY(right.bbox) || Number(left.bbox[0]) - Number(right.bbox[0]))) {
    const match = lines.find((line) => Math.abs(centerY(word.bbox) - line.center_y) <= Math.max(boxHeight(word.bbox), line.height) * 0.55);
    if (match) {
      match.words.push(word);
      match.center_y = match.words.reduce((sum, item) => sum + centerY(item.bbox), 0) / match.words.length;
      match.height = Math.max(match.height, boxHeight(word.bbox));
    } else {
      lines.push({ words: [word], center_y: centerY(word.bbox), height: boxHeight(word.bbox) });
    }
  }
  return lines.map((line) => {
    const ordered = line.words.sort((left, right) => Number(left.bbox[0]) - Number(right.bbox[0]));
    return {
      text: ordered.map((word) => word.text).join(' '),
      bbox: [
        Math.min(...ordered.map((word) => Number(word.bbox[0]))),
        Math.min(...ordered.map((word) => Number(word.bbox[1]))),
        Math.max(...ordered.map((word) => Number(word.bbox[2]))),
        Math.max(...ordered.map((word) => Number(word.bbox[3])))
      ],
      confidence: ordered.every((word) => Number.isFinite(word.confidence))
        ? ordered.reduce((sum, word) => sum + Number(word.confidence), 0) / ordered.length
        : null
    };
  });
}

function fieldsToVerify(parsed, linkResult, catalogIsTrusted) {
  const fields = ['drug'];
  if (parsed.strengths.length === 0 || !linkResult?.status || linkResult.status !== 'linked' || !catalogIsTrusted) fields.push('strength');
  return fields;
}

export function buildMedicationDraft({ prescriptionId, ocrWords, catalog, catalogIsTrusted = false, linkOptions = {} }) {
  const lines = groupOcrWordsIntoLines(ocrWords);
  const candidates = [];
  const notes = [];
  for (const line of lines) {
    const parsed = extractDrugNameAndStrength(line.text);
    if (parsed.drug_name.length < 3) continue;
    const linked = linkDrug({ drug_name: parsed.drug_name, strength: parsed.strengths[0], raw_text: line.text }, catalog, linkOptions);
    if (linked.status === 'not_found') continue;
    candidates.push({ line, parsed, linked });
  }

  const medications = candidates.map((candidate, index) => {
    const { line, parsed, linked } = candidate;
    const isVerifiedLink = linked.status === 'linked' && catalogIsTrusted;
    if (!isVerifiedLink) notes.push(`Medication ${index + 1} cần người dùng xác nhận tên thuốc/hàm lượng.`);
    return {
      medication_id: `${prescriptionId}-med-${index + 1}`,
      drug_database_id: linked.status === 'linked' ? linked.drug_database_id : null,
      drug_name: linked.status === 'linked' ? linked.normalized_name : parsed.drug_name,
      prescribed: {
        raw_text: line.text,
        strength: parsed.strengths[0] ?? null,
        dose: null,
        frequency: null,
        duration: null,
        timing: null,
        route: null,
        instruction: null
      },
      verification: {
        status: 'needs_review',
        fields_to_verify: fieldsToVerify(parsed, linked, catalogIsTrusted)
      },
      reminder_schedule: []
    };
  });

  return {
    plan: {
      plan_id: `${prescriptionId}-plan`,
      prescription_id: prescriptionId,
      status: 'needs_verification',
      medications
    },
    extraction_notes: notes.length > 0 ? notes : ['Không phát hiện thuốc đủ bằng chứng để tạo draft.']
  };
}
