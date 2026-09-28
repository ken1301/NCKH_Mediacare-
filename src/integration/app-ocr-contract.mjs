const FREQUENCIES = new Set([
  'ONCE_DAILY',
  'TWICE_DAILY',
  'THREE_TIMES_DAILY',
  'DAILY',
  'WEEKLY',
  'EVERY_OTHER_DAY',
  'AS_NEEDED'
]);

const TIME_PATTERN = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeComparableText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function frequencyFromText(value) {
  const text = normalizeComparableText(value);
  if (!text) return null;
  if (/as needed|prn|khi can|khi co nhu cau/.test(text)) return 'AS_NEEDED';
  if (/every other day|cach ngay|moi hai ngay/.test(text)) return 'EVERY_OTHER_DAY';
  if (/weekly|moi tuan|hang tuan/.test(text)) return 'WEEKLY';
  if (/(3|ba)\s*(lan|times)|three times/.test(text)) return 'THREE_TIMES_DAILY';
  if (/(2|hai)\s*(lan|times)|twice|sang.*toi|toi.*sang/.test(text)) return 'TWICE_DAILY';
  if (/once daily|1\s*(lan|time)\s*(\/|moi|per)?\s*(ngay|day)|mot lan moi ngay/.test(text)) return 'ONCE_DAILY';
  if (/daily|moi ngay|hang ngay/.test(text)) return 'DAILY';
  return null;
}

function defaultTimesPerDay(frequency) {
  return {
    ONCE_DAILY: 1,
    TWICE_DAILY: 2,
    THREE_TIMES_DAILY: 3,
    DAILY: 1
  }[frequency] ?? null;
}

function normalizeFrequency(input) {
  const raw = cleanText(input.frequency);
  const source = cleanText(input.frequencySource) || raw || null;
  if (FREQUENCIES.has(raw)) {
    return { frequency: raw, frequencySource: source, recognized: true };
  }
  const normalized = frequencyFromText(source);
  return { frequency: normalized, frequencySource: source, recognized: normalized !== null };
}

function normalizeTimeSlots(value) {
  if (value === null || value === undefined) return null;
  assert(Array.isArray(value), 'timeSlots phải là array hoặc null.');
  const slots = value.map((time) => cleanText(time));
  assert(slots.every((time) => TIME_PATTERN.test(time)), 'timeSlots phải dùng định dạng HH:mm.');
  assert(new Set(slots).size === slots.length, 'timeSlots không được chứa giờ trùng nhau.');
  return [...slots].sort();
}

function normalizePositiveInteger(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  assert(Number.isInteger(number) && number > 0, `${fieldName} phải là số nguyên dương.`);
  return number;
}

export function normalizeParsedMedication(input) {
  assert(input && typeof input === 'object', 'ParsedMedication phải là object.');
  const medicineName = cleanText(input.medicineName);
  assert(medicineName.length > 0, 'medicineName là bắt buộc.');

  const normalizedFrequency = normalizeFrequency(input);
  const timeSlots = normalizeTimeSlots(input.timeSlots);
  const explicitTimesPerDay = normalizePositiveInteger(input.timesPerDay, 'timesPerDay');
  const timesPerDay = explicitTimesPerDay ?? defaultTimesPerDay(normalizedFrequency.frequency);
  const countMismatch = timeSlots !== null && timesPerDay !== null && timeSlots.length !== timesPerDay;
  const needsTimeReview = normalizedFrequency.frequency !== 'AS_NEEDED'
    && (timeSlots === null || timesPerDay === null || countMismatch);

  return {
    medicineName,
    totalQuantity: input.totalQuantity ?? null,
    unit: cleanText(input.unit) || null,
    dosage: cleanText(input.dosage) || null,
    frequency: normalizedFrequency.frequency,
    frequencySource: normalizedFrequency.frequencySource,
    frequencyRequiresReview: input.frequencyRequiresReview === true
      || !normalizedFrequency.recognized
      || needsTimeReview,
    timesPerDay,
    timeSlots,
    doseQuantity: input.doseQuantity === undefined ? null : normalizePositiveInteger(input.doseQuantity, 'doseQuantity'),
    doseUnit: cleanText(input.doseUnit) || null,
    durationDays: input.durationDays === undefined ? null : normalizePositiveInteger(input.durationDays, 'durationDays'),
    notes: cleanText(input.notes) || null
  };
}

function parseDate(value, fieldName) {
  assert(typeof value === 'string' && DATE_PATTERN.test(value), `${fieldName} phải có định dạng YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  assert(!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value, `${fieldName} không hợp lệ.`);
  return date;
}

export function validateCreateMedicationRequest(input) {
  assert(input && typeof input === 'object', 'CreateMedicationRequest phải là object.');
  const medicineName = cleanText(input.medicineName);
  assert(medicineName.length > 0, 'medicineName là bắt buộc.');
  assert(FREQUENCIES.has(input.frequency), 'frequency không hợp lệ hoặc chưa được normalize.');
  const startDate = parseDate(input.startDate, 'startDate');
  const endDate = input.endDate === undefined || input.endDate === null ? null : parseDate(input.endDate, 'endDate');
  assert(!endDate || endDate >= startDate, 'endDate không được trước startDate.');

  const timesPerDay = input.timesPerDay === undefined || input.timesPerDay === null
    ? null
    : normalizePositiveInteger(input.timesPerDay, 'timesPerDay');
  const timeSlots = normalizeTimeSlots(input.timeSlots);

  if (input.frequency === 'AS_NEEDED') {
    assert(timeSlots === null || timesPerDay === null || timeSlots.length === timesPerDay,
      'timesPerDay phải khớp số lượng timeSlots.');
  } else {
    assert(timeSlots !== null && timeSlots.length > 0, 'Thuốc không phải AS_NEEDED phải có timeSlots.');
    assert(timesPerDay !== null, 'Thuốc không phải AS_NEEDED phải có timesPerDay.');
    assert(timesPerDay === timeSlots.length, 'timesPerDay phải khớp số lượng timeSlots.');
  }

  if (input.frequency === 'TWICE_DAILY') {
    assert(timeSlots !== null && timeSlots.length === 2 && timesPerDay === 2, 'TWICE_DAILY phải có đúng 2 giờ.');
  }

  return {
    ...input,
    medicineName,
    timeSlots,
    timesPerDay
  };
}

export function calculateInclusiveEndDate(startDateValue, durationDays) {
  const startDate = parseDate(startDateValue, 'startDate');
  const days = normalizePositiveInteger(durationDays, 'durationDays');
  assert(days !== null, 'durationDays là bắt buộc để tính endDate.');
  startDate.setUTCDate(startDate.getUTCDate() + days - 1);
  return startDate.toISOString().slice(0, 10);
}

export { FREQUENCIES, TIME_PATTERN };
