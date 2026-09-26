import test from "node:test";
import assert from "node:assert/strict";
import {
  createDrugCatalogRepository,
  linkDrug,
  normalizeDrugText,
  parseStrength
} from "../src/catalog/drug-catalog.mjs";

const catalog = [
  {
    drug_database_id: "test:augmentin-625",
    brand_name: "Augmentin",
    generic_names: ["amoxicillin/clavulanic acid"],
    strengths: [{ value: 625, unit: "mg" }]
  },
  {
    drug_database_id: "test:paracetamol-500",
    brand_name: "Paracetamol",
    generic_names: ["acetaminophen"],
    strengths: [{ value: 500, unit: "mg" }]
  },
  {
    drug_database_id: "test:paracetamol-650",
    brand_name: "Paracetamol",
    generic_names: ["acetaminophen"],
    strengths: [{ value: 650, unit: "mg" }]
  }
];

test("chuẩn hóa lỗi OCR đơn vị và dấu tiếng Việt", () => {
  assert.equal(normalizeDrugText("Augrnentin 625rng"), "augrnentin 625 mg");
  assert.equal(normalizeDrugText("Paracetamol 500 mg"), "paracetamol 500 mg");
});

test("parseStrength chuẩn hóa đơn vị về giá trị so sánh", () => {
  assert.deepEqual(parseStrength("0,625 g"), {
    value: 0.625,
    unit: "g",
    comparable_mg: 625
  });
});

test("liên kết Augrnentin bị OCR sai với đúng hàm lượng", () => {
  const result = linkDrug({ raw_text: "Augrnentin 625rng" }, catalog);
  assert.equal(result.status, "linked");
  assert.equal(result.drug_database_id, "test:augmentin-625");
});

test("yêu cầu review khi thiếu hàm lượng và có hai ứng viên cùng tên", () => {
  const result = linkDrug({ drug_name: "Paracetamol" }, catalog);
  assert.equal(result.status, "needs_review");
  assert.equal(result.reason, "multiple_candidates");
});

test("trả not_found với tên không có trong catalog", () => {
  const result = linkDrug({ drug_name: "ThuocKhongTonTai" }, catalog);
  assert.equal(result.status, "not_found");
});

test("repository hỗ trợ thêm, tìm kiếm và liên kết", () => {
  const repository = createDrugCatalogRepository(catalog);
  assert.equal(repository.list().length, 3);
  assert.equal(repository.search({ drug_name: "Augmentin" })[0].drug_database_id, "test:augmentin-625");
  assert.equal(repository.link({ raw_text: "Augrnentin 625rng" }).status, "linked");
});

