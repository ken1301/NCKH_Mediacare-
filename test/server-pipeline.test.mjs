import test from "node:test";
import assert from "node:assert/strict";
import { buildMedicationDraft } from "../src/pipeline/medication-understanding.mjs";

test("OCR pipeline output is a medication-plan-compatible draft", () => {
  const result = buildMedicationDraft({
    prescriptionId: "rx-api-1",
    ocrWords: [
      { text: "RENAPRIL", bbox: [10, 10, 80, 30] },
      { text: "5MG", bbox: [85, 10, 120, 30] }
    ],
    catalog: [{ drug_database_id: "candidate:renapril", brand_name: "RENAPRIL", strengths: [{ value: 5, unit: "mg" }] }],
    catalogIsTrusted: false
  });
  assert.equal(result.plan.prescription_id, "rx-api-1");
  assert.equal(result.plan.status, "needs_verification");
  assert.equal(result.plan.medications[0].prescribed.strength, "5MG");
});
