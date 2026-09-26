import test from "node:test";
import assert from "node:assert/strict";
import {
  createMedicationPlan,
  scheduleMedication,
  verifyMedicationFields
} from "../src/domain/medication-plan.mjs";

function samplePlan() {
  return createMedicationPlan({
    plan_id: "plan-001",
    prescription_id: "rx-001",
    medications: [
      {
        medication_id: "med-001",
        drug_name: "Augmentin",
        prescribed: {
          raw_text: "Augrnentin 625rng - 1v x 2 lan/ngay",
          strength: "625 mg",
          dose: "1 viên/lần",
          frequency: "2 lần/ngày",
          duration: "7 ngày",
          timing: "sau ăn"
        },
        verification: {
          status: "needs_review",
          fields_to_verify: ["strength"]
        }
      }
    ]
  });
}

test("plan bắt đầu ở needs_verification khi còn field quan trọng", () => {
  const plan = samplePlan();
  assert.equal(plan.status, "needs_verification");
  assert.deepEqual(plan.medications[0].verification.fields_to_verify, ["strength"]);
});

test("xác nhận field chuyển plan sang verified", () => {
  const plan = verifyMedicationFields(samplePlan(), "med-001", ["strength"]);
  assert.equal(plan.status, "verified");
  assert.equal(plan.medications[0].verification.status, "verified");
});

test("không cho lập lịch khi plan chưa verified", () => {
  assert.throws(
    () => scheduleMedication(samplePlan(), "med-001", ["08:00", "20:00"]),
    /verified/
  );
});

test("lập lịch sau khi verified và loại giờ trùng", () => {
  const verified = verifyMedicationFields(samplePlan(), "med-001", ["strength"]);
  const scheduled = scheduleMedication(verified, "med-001", ["20:00", "08:00", "08:00"]);
  assert.equal(scheduled.status, "scheduled");
  assert.deepEqual(scheduled.medications[0].reminder_schedule, ["08:00", "20:00"]);
});

test("từ chối giờ nhắc sai định dạng", () => {
  const verified = verifyMedicationFields(samplePlan(), "med-001", ["strength"]);
  assert.throws(
    () => scheduleMedication(verified, "med-001", ["8h00"]),
    /HH:mm/
  );
});

