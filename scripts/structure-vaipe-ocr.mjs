import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const input = path.resolve(option("--input", path.join(root, "dataset", "processed", "vaipe-text-finetuned", "all.json")));
const outputDir = path.resolve(option("--output-dir", path.dirname(input)));
const records = JSON.parse(await fs.readFile(input, "utf8"));

const quantityPattern = /\bSL\s*:\s*([\d.,]+)\s*([^\d\s,;]+)/i;
const strengthPattern = /\b(\d+(?:[.,]\d+)?)\s*(mg|g|ml|mcg|µg|%)\b/gi;
const datePattern = /\b(?:ngày\s*)?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/i;
const medicinePattern = /^\s*(\d{1,3})\s*[).:-]\s*(.+)$/;

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseMedicine(line, index) {
  const match = line.match(medicinePattern);
  if (!match) return null;
  const raw = clean(match[2]);
  const quantity = raw.match(quantityPattern);
  const beforeQuantity = clean(quantity ? raw.slice(0, quantity.index) : raw);
  const strengths = [...beforeQuantity.matchAll(strengthPattern)].map((m) => `${m[1]} ${m[2]}`);
  let name = beforeQuantity;
  if (strengths.length) {
    name = clean(beforeQuantity.replace(/\s+\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|µg|%)\s*$/i, ""));
  }
  return {
    order: Number(match[1]),
    name: name || beforeQuantity,
    strength: strengths.join(" ") || null,
    quantity: quantity ? quantity[1] : null,
    unit: quantity ? clean(quantity[2]) : null,
    instructions: [],
    raw,
    source_line: index + 1,
  };
}

function structure(record) {
  const lines = record.lines.map((line) => clean(line.text)).filter(Boolean);
  const medicines = [];
  const diagnoses = [];
  const dates = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const medicine = parseMedicine(line, i);
    if (medicine) {
      medicines.push(medicine);
      current = medicine;
      continue;
    }
    if (current && /ghi ch/i.test(line)) {
      const instruction = clean(line.replace(/^ghi ch[^ ]*\s*/i, ""));
      if (instruction) current.instructions.push(instruction);
      continue;
    }
    if (/(chẩn đoán|cận lâm sàng|bệnh lý|diagnos|i10|g\d{2})/i.test(line)) diagnoses.push(line);
    const date = line.match(datePattern);
    if (date) dates.push(date[1]);
  }
  return {
    sample_id: record.sample_id,
    image: record.image,
    patient_and_header: lines.slice(0, Math.min(7, lines.length)),
    diagnoses,
    dates: [...new Set(dates)],
    medicines,
    raw_text: record.text,
    lines: record.lines,
  };
}

const structured = records.map(structure);
await fs.writeFile(path.join(outputDir, "structured.json"), JSON.stringify(structured, null, 2) + "\n", "utf8");
await fs.writeFile(path.join(outputDir, "structured.jsonl"), structured.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
const totalMedicines = structured.reduce((sum, row) => sum + row.medicines.length, 0);
console.log(JSON.stringify({ records: structured.length, medicines: totalMedicines, output: outputDir }));
