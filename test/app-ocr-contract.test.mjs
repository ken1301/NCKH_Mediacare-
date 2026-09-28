import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInclusiveEndDate,
  normalizeParsedMedication,
  validateCreateMedicationRequest
} from '../src/integration/app-ocr-contract.mjs';

test('normalize output giữ source và không tự đoán giờ', () => {
  const medication = normalizeParsedMedication({
    medicineName: 'Paracetamol 500mg',
    frequencySource: 'Uống ngày 2 lần',
    dosage: '1 viên/lần',
    durationDays: 15
  });

  assert.equal(medication.frequency, 'TWICE_DAILY');
  assert.equal(medication.timesPerDay, 2);
  assert.equal(medication.timeSlots, null);
  assert.equal(medication.frequencyRequiresReview, true);
});

test('normalize output nhận timeSlots explicit và giữ đầy đủ fields', () => {
  const medication = normalizeParsedMedication({
    medicineName: 'Paracetamol 500mg',
    frequency: 'TWICE_DAILY',
    timeSlots: ['20:00', '08:00'],
    timesPerDay: 2,
    doseQuantity: 1,
    doseUnit: 'TABLET',
    totalQuantity: 30,
    unit: 'Viên'
  });

  assert.deepEqual(medication.timeSlots, ['08:00', '20:00']);
  assert.equal(medication.frequencyRequiresReview, false);
  assert.equal(medication.doseQuantity, 1);
  assert.equal(medication.doseUnit, 'TABLET');
});

test('validate schedule request yêu cầu giờ và khớp số lần', () => {
  assert.throws(
    () => validateCreateMedicationRequest({
      medicineName: 'Paracetamol 500mg',
      frequency: 'TWICE_DAILY',
      timesPerDay: 2,
      timeSlots: ['08:00'],
      startDate: '2026-09-28',
      endDate: '2026-10-12'
    }),
    /TWICE_DAILY|khớp/
  );

  const request = validateCreateMedicationRequest({
    medicineName: 'Paracetamol 500mg',
    dosage: '1 viên/lần',
    frequency: 'TWICE_DAILY',
    timesPerDay: 2,
    timeSlots: ['08:00', '20:00'],
    startDate: '2026-09-28',
    endDate: '2026-10-12'
  });
  assert.deepEqual(request.timeSlots, ['08:00', '20:00']);
});

test('AS_NEEDED không bắt buộc timeSlots', () => {
  assert.doesNotThrow(() => validateCreateMedicationRequest({
    medicineName: 'Thuốc khi cần',
    frequency: 'AS_NEEDED',
    startDate: '2026-09-28'
  }));
});

test('endDate bao gồm ngày bắt đầu', () => {
  assert.equal(calculateInclusiveEndDate('2026-09-28', 1), '2026-09-28');
  assert.equal(calculateInclusiveEndDate('2026-09-28', 15), '2026-10-12');
});
