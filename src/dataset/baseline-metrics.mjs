export function normalizeOcrText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function levenshtein(left, right) {
  const a = [...String(left ?? '')];
  const b = [...String(right ?? '')];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

export function characterErrorRate(reference, prediction) {
  const gold = normalizeOcrText(reference);
  const predicted = normalizeOcrText(prediction);
  return gold.length === 0 ? (predicted.length === 0 ? 0 : 1) : levenshtein(gold, predicted) / gold.length;
}

export function wordErrorRate(reference, prediction) {
  const gold = normalizeOcrText(reference).split(' ').filter(Boolean);
  const predicted = normalizeOcrText(prediction).split(' ').filter(Boolean);
  const goldText = gold.join('\u0000');
  const predictedText = predicted.join('\u0000');
  return gold.length === 0 ? (predicted.length === 0 ? 0 : 1) : levenshtein(goldText, predictedText) / gold.length;
}

export function boxIoU(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length < 4 || second.length < 4) return 0;
  const [ax1, ay1, ax2, ay2] = first.map(Number);
  const [bx1, by1, bx2, by2] = second.map(Number);
  if (![ax1, ay1, ax2, ay2, bx1, by1, bx2, by2].every(Number.isFinite)) return 0;
  const intersectionWidth = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const intersectionHeight = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  const intersection = intersectionWidth * intersectionHeight;
  const firstArea = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  const secondArea = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);
  const union = firstArea + secondArea - intersection;
  return union > 0 ? intersection / union : 0;
}

function f1(precision, recall) {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

function matchEntities(goldEntities, predictedEntities, iouThreshold) {
  const candidates = [];
  for (let goldIndex = 0; goldIndex < goldEntities.length; goldIndex += 1) {
    for (let predictedIndex = 0; predictedIndex < predictedEntities.length; predictedIndex += 1) {
      const gold = goldEntities[goldIndex];
      const predicted = predictedEntities[predictedIndex];
      if (gold.label !== predicted.label) continue;
      const iou = boxIoU(gold.bbox, predicted.bbox);
      if (iou >= iouThreshold) candidates.push({ goldIndex, predictedIndex, iou });
    }
  }
  candidates.sort((left, right) => right.iou - left.iou);
  const usedGold = new Set();
  const usedPredicted = new Set();
  const matches = [];
  for (const candidate of candidates) {
    if (usedGold.has(candidate.goldIndex) || usedPredicted.has(candidate.predictedIndex)) continue;
    usedGold.add(candidate.goldIndex);
    usedPredicted.add(candidate.predictedIndex);
    matches.push(candidate);
  }
  return matches;
}

export function evaluateEntities(goldEntities, predictedEntities, { iouThreshold = 0.5 } = {}) {
  const gold = Array.isArray(goldEntities) ? goldEntities : [];
  const predicted = Array.isArray(predictedEntities) ? predictedEntities : [];
  const matches = matchEntities(gold, predicted, iouThreshold);
  const precision = predicted.length === 0 ? (gold.length === 0 ? 1 : 0) : matches.length / predicted.length;
  const recall = gold.length === 0 ? (predicted.length === 0 ? 1 : 0) : matches.length / gold.length;
  const result = {
    gold_count: gold.length,
    predicted_count: predicted.length,
    matched_count: matches.length,
    precision,
    recall,
    f1: f1(precision, recall),
    text_exact_accuracy: 0,
    mean_cer: 0,
    mean_wer: 0,
    by_label: {}
  };
  const labels = new Set([...gold, ...predicted].map((entity) => entity.label));
  for (const label of labels) {
    const labelGold = gold.filter((entity) => entity.label === label);
    const labelPredicted = predicted.filter((entity) => entity.label === label);
    const labelResult = evaluateEntitiesWithoutRecursion(labelGold, labelPredicted, iouThreshold);
    result.by_label[label] = labelResult;
  }
  if (matches.length > 0) {
    const textResults = matches.map(({ goldIndex, predictedIndex }) => ({
      gold: gold[goldIndex],
      predicted: predicted[predictedIndex]
    }));
    result.text_exact_accuracy = textResults.filter(({ gold: left, predicted: right }) => normalizeOcrText(left.text) === normalizeOcrText(right.text)).length / matches.length;
    result.mean_cer = textResults.reduce((sum, pair) => sum + characterErrorRate(pair.gold.text, pair.predicted.text), 0) / matches.length;
    result.mean_wer = textResults.reduce((sum, pair) => sum + wordErrorRate(pair.gold.text, pair.predicted.text), 0) / matches.length;
  }
  return result;
}

export function evaluateOcrWords(goldWords, predictedWords, { iouThreshold = 0.5 } = {}) {
  const gold = Array.isArray(goldWords) ? goldWords : [];
  const predicted = Array.isArray(predictedWords) ? predictedWords : [];
  const candidates = [];
  for (let goldIndex = 0; goldIndex < gold.length; goldIndex += 1) {
    for (let predictedIndex = 0; predictedIndex < predicted.length; predictedIndex += 1) {
      const iou = boxIoU(gold[goldIndex].bbox ?? gold[goldIndex].box, predicted[predictedIndex].bbox ?? predicted[predictedIndex].box);
      if (iou >= iouThreshold) candidates.push({ goldIndex, predictedIndex, iou });
    }
  }
  candidates.sort((left, right) => right.iou - left.iou);
  const usedGold = new Set();
  const usedPredicted = new Set();
  const matches = [];
  for (const candidate of candidates) {
    if (usedGold.has(candidate.goldIndex) || usedPredicted.has(candidate.predictedIndex)) continue;
    usedGold.add(candidate.goldIndex);
    usedPredicted.add(candidate.predictedIndex);
    matches.push(candidate);
  }
  const precision = predicted.length === 0 ? (gold.length === 0 ? 1 : 0) : matches.length / predicted.length;
  const recall = gold.length === 0 ? (predicted.length === 0 ? 1 : 0) : matches.length / gold.length;
  const textPairs = matches.map(({ goldIndex, predictedIndex }) => ({
    gold: gold[goldIndex].text ?? '',
    predicted: predicted[predictedIndex].text ?? ''
  }));
  return {
    gold_count: gold.length,
    predicted_count: predicted.length,
    matched_count: matches.length,
    precision,
    recall,
    f1: f1(precision, recall),
    text_exact_accuracy: textPairs.length === 0 ? 0 : textPairs.filter((pair) => normalizeOcrText(pair.gold) === normalizeOcrText(pair.predicted)).length / textPairs.length,
    mean_cer: textPairs.length === 0 ? 0 : textPairs.reduce((sum, pair) => sum + characterErrorRate(pair.gold, pair.predicted), 0) / textPairs.length,
    mean_wer: textPairs.length === 0 ? 0 : textPairs.reduce((sum, pair) => sum + wordErrorRate(pair.gold, pair.predicted), 0) / textPairs.length
  };
}

function evaluateEntitiesWithoutRecursion(gold, predicted, iouThreshold) {
  const matches = matchEntities(gold, predicted, iouThreshold);
  const precision = predicted.length === 0 ? (gold.length === 0 ? 1 : 0) : matches.length / predicted.length;
  const recall = gold.length === 0 ? (predicted.length === 0 ? 1 : 0) : matches.length / gold.length;
  return {
    gold_count: gold.length,
    predicted_count: predicted.length,
    matched_count: matches.length,
    precision,
    recall,
    f1: f1(precision, recall)
  };
}
