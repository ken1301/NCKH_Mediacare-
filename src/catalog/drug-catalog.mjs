const UNIT_TO_MG = new Map([
  ["mcg", 0.001],
  ["µg", 0.001],
  ["ug", 0.001],
  ["mg", 1],
  ["g", 1000]
]);

function removeVietnameseMarks(value) {
  return value
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function normalizeDrugText(value) {
  if (value === null || value === undefined) return "";

  let normalized = removeVietnameseMarks(String(value).normalize("NFKC").toLowerCase());
  normalized = normalized
    .replace(/(?:rng|mng)\b/g, "mg")
    .replace(/(\d)\s*(mg|mcg|ug|µg|g|ml)\b/g, "$1 $2")
    .replace(/[^a-z0-9µ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

export function parseStrength(value) {
  if (value === null || value === undefined) return null;
  const normalized = removeVietnameseMarks(String(value).normalize("NFKC").toLowerCase())
    .replace(/(?:rng|mng)\b/g, "mg")
    .replace(/\s+/g, " ");
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(mcg|ug|µg|mg|g|ml)\b/);
  if (!match) return null;

  const numericValue = Number(match[1].replace(",", "."));
  const unit = match[2];
  return {
    value: numericValue,
    unit,
    comparable_mg: UNIT_TO_MG.has(unit) ? numericValue * UNIT_TO_MG.get(unit) : null
  };
}

function levenshtein(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const insertion = current[column - 1] + 1;
      const deletion = previous[column] + 1;
      const substitution = previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
      current.push(Math.min(insertion, deletion, substitution));
    }
    for (let column = 0; column <= right.length; column += 1) previous[column] = current[column];
  }
  return previous[right.length];
}

export function stringSimilarity(left, right) {
  const a = normalizeDrugText(left);
  const b = normalizeDrugText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

function catalogAliases(entry) {
  return [
    entry.brand_name,
    ...(entry.generic_names ?? []),
    ...(entry.aliases ?? [])
  ].filter(Boolean);
}

function compareStrength(queryStrength, entry) {
  if (!queryStrength) return { score: 0.5, matched: false };
  const query = parseStrength(queryStrength);
  if (!query) return { score: 0, matched: false };

  const strengths = (entry.strengths ?? [])
    .map((strength) => parseStrength(`${strength.value} ${strength.unit}`))
    .filter(Boolean);

  if (strengths.length === 0) return { score: 0.25, matched: false };
  const exact = strengths.some((strength) => {
    if (query.comparable_mg !== null && strength.comparable_mg !== null) {
      return query.comparable_mg === strength.comparable_mg;
    }
    return query.value === strength.value && query.unit === strength.unit;
  });

  return { score: exact ? 1 : 0, matched: exact };
}

function scoreCandidate(query, entry) {
  const rawQuery = normalizeDrugText(query.drug_name ?? query.raw_text ?? "");
  const queryName = query.drug_name ?? rawQuery.replace(/\b\d+(?:[.,]\d+)?\s*(?:mcg|ug|µg|mg|g|ml)\b/g, "").trim();
  const aliases = catalogAliases(entry);
  const nameScores = aliases.map((alias) => ({ alias, score: stringSimilarity(queryName, alias) }));
  const bestName = nameScores.sort((left, right) => right.score - left.score)[0] ?? { alias: null, score: 0 };
  const strength = compareStrength(query.strength ?? query.raw_text, entry);
  const hasStrengthSignal = Boolean(query.strength ?? parseStrength(query.raw_text));
  const score = hasStrengthSignal
    ? bestName.score * 0.8 + strength.score * 0.2
    : bestName.score;

  return {
    drug_database_id: entry.drug_database_id,
    brand_name: entry.brand_name,
    score: Number(score.toFixed(6)),
    matched_alias: bestName.alias,
    matched_on: [bestName.score > 0 ? "name" : null, strength.matched ? "strength" : null].filter(Boolean)
  };
}

export function findDrugCandidates(query, catalog, limit = 5) {
  const normalizedName = normalizeDrugText(query?.drug_name ?? query?.raw_text ?? "");
  if (normalizedName.length < 3) return [];

  return catalog
    .map((entry) => scoreCandidate(query, entry))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function linkDrug(query, catalog, options = {}) {
  const threshold = options.threshold ?? 0.82;
  const ambiguityMargin = options.ambiguity_margin ?? 0.05;
  const candidates = findDrugCandidates(query, catalog);

  if (candidates.length === 0 || candidates[0].score < threshold) {
    return { status: "not_found", candidates };
  }

  const best = candidates[0];
  const second = candidates[1];
  const ambiguous = second && best.score - second.score < ambiguityMargin;

  if (ambiguous) {
    return {
      status: "needs_review",
      reason: "multiple_candidates",
      candidates
    };
  }

  return {
    status: "linked",
    drug_database_id: best.drug_database_id,
    normalized_name: best.brand_name,
    confidence: best.score,
    candidates
  };
}

export function createDrugCatalogRepository(initialEntries = []) {
  const entries = new Map();
  for (const entry of initialEntries) {
    if (!entry?.drug_database_id) throw new Error("Drug catalog entry thiếu drug_database_id.");
    entries.set(entry.drug_database_id, structuredClone(entry));
  }

  return {
    add(entry) {
      if (!entry?.drug_database_id) throw new Error("Drug catalog entry thiếu drug_database_id.");
      entries.set(entry.drug_database_id, structuredClone(entry));
    },
    list() {
      return [...entries.values()].map((entry) => structuredClone(entry));
    },
    search(query, limit) {
      return findDrugCandidates(query, [...entries.values()], limit);
    },
    link(query, options) {
      return linkDrug(query, [...entries.values()], options);
    }
  };
}
