const VERIFIABLE_FIELDS = new Set([
  "drug",
  "strength",
  "dose",
  "frequency",
  "duration",
  "timing",
  "route",
  "instruction"
]);

const TIME_PATTERN = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;

function assert(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function medicationNeedsVerification(medication) {
  return medication.verification.status !== "verified" || medication.verification.fields_to_verify.length > 0;
}

function planNeedsVerification(medications) {
  return medications.some(medicationNeedsVerification);
}

export function createMedicationPlan(input) {
  assert(input && typeof input === "object", "Request body phải là object.");
  assert(typeof input.plan_id === "string" && input.plan_id.length > 0, "Thiếu plan_id.");
  assert(typeof input.prescription_id === "string" && input.prescription_id.length > 0, "Thiếu prescription_id.");
  assert(Array.isArray(input.medications) && input.medications.length > 0, "medications phải có ít nhất một phần tử.");

  const medications = input.medications.map((medication, index) => {
    assert(typeof medication.medication_id === "string" && medication.medication_id.length > 0, `Thiếu medication_id tại vị trí ${index}.`);
    assert(typeof medication.drug_name === "string" && medication.drug_name.length > 0, `Thiếu drug_name tại vị trí ${index}.`);
    assert(medication.prescribed && typeof medication.prescribed === "object", `Thiếu prescribed tại vị trí ${index}.`);
    assert(medication.verification && typeof medication.verification === "object", `Thiếu verification tại vị trí ${index}.`);

    const fieldsToVerify = medication.verification.fields_to_verify ?? [];
    assert(Array.isArray(fieldsToVerify), `fields_to_verify phải là array tại vị trí ${index}.`);
    assert(fieldsToVerify.every((field) => VERIFIABLE_FIELDS.has(field)), `Trường verification không hợp lệ tại vị trí ${index}.`);

    return {
      medication_id: medication.medication_id,
      drug_database_id: medication.drug_database_id ?? null,
      drug_name: medication.drug_name,
      prescribed: {
        raw_text: medication.prescribed.raw_text ?? medication.drug_name,
        strength: medication.prescribed.strength ?? null,
        dose: medication.prescribed.dose ?? null,
        frequency: medication.prescribed.frequency ?? null,
        duration: medication.prescribed.duration ?? null,
        timing: medication.prescribed.timing ?? null,
        route: medication.prescribed.route ?? null,
        instruction: medication.prescribed.instruction ?? null
      },
      verification: {
        status: medication.verification.status === "verified" ? "verified" : "needs_review",
        fields_to_verify: [...new Set(fieldsToVerify)]
      },
      reminder_schedule: []
    };
  });

  return {
    plan_id: input.plan_id,
    prescription_id: input.prescription_id,
    status: planNeedsVerification(medications) ? "needs_verification" : "verified",
    medications
  };
}

export function verifyMedicationFields(plan, medicationId, fields = []) {
  const nextPlan = clone(plan);
  const medication = nextPlan.medications.find((item) => item.medication_id === medicationId);
  assert(medication, `Không tìm thấy medication_id: ${medicationId}.`);
  assert(Array.isArray(fields), "fields phải là array.");
  assert(fields.every((field) => VERIFIABLE_FIELDS.has(field)), "fields chứa trường không hợp lệ.");

  const remaining = medication.verification.fields_to_verify.filter((field) => !fields.includes(field));
  medication.verification.fields_to_verify = remaining;
  medication.verification.status = remaining.length === 0 ? "verified" : "needs_review";
  nextPlan.status = planNeedsVerification(nextPlan.medications) ? "needs_verification" : "verified";
  return nextPlan;
}

export function scheduleMedication(plan, medicationId, times) {
  const nextPlan = clone(plan);
  const medication = nextPlan.medications.find((item) => item.medication_id === medicationId);
  assert(medication, `Không tìm thấy medication_id: ${medicationId}.`);
  assert(nextPlan.status === "verified", "Chỉ được tạo lịch nhắc sau khi toàn bộ plan đã verified.");
  assert(medication.verification.status === "verified", "Thuốc chưa được xác nhận.");
  assert(Array.isArray(times) && times.length > 0, "times phải có ít nhất một giờ nhắc.");
  assert(times.every((time) => typeof time === "string" && TIME_PATTERN.test(time)), "Giờ nhắc phải có dạng HH:mm.");

  medication.reminder_schedule = [...new Set(times)].sort();
  nextPlan.status = "scheduled";
  return nextPlan;
}

export function createPlanStore() {
  const plans = new Map();

  return {
    create(plan) {
      assert(!plans.has(plan.plan_id), `plan_id đã tồn tại: ${plan.plan_id}.`);
      const stored = clone(plan);
      plans.set(stored.plan_id, stored);
      return clone(stored);
    },
    get(planId) {
      const plan = plans.get(planId);
      return plan ? clone(plan) : null;
    },
    update(plan) {
      assert(plans.has(plan.plan_id), `Không tìm thấy plan_id: ${plan.plan_id}.`);
      plans.set(plan.plan_id, clone(plan));
      return clone(plan);
    }
  };
}

