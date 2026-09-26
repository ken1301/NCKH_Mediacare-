import { createServer } from "node:http";
import {
  createMedicationPlan,
  createPlanStore,
  scheduleMedication,
  verifyMedicationFields
} from "./domain/medication-plan.mjs";

const store = createPlanStore();
const port = Number(process.env.PORT ?? 3000);

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body không phải JSON hợp lệ.");
    error.statusCode = 400;
    throw error;
  }
}

function routeParts(url) {
  return new URL(url, "http://localhost").pathname.split("/").filter(Boolean);
}

const server = createServer(async (request, response) => {
  try {
    const parts = routeParts(request.url);

    if (request.method === "GET" && parts.length === 1 && parts[0] === "health") {
      return sendJson(response, 200, { status: "ok", service: "medicare-backend" });
    }

    if (request.method === "POST" && parts.length === 1 && parts[0] === "prescriptions") {
      const plan = store.create(createMedicationPlan(await readJson(request)));
      return sendJson(response, 201, plan);
    }

    if (parts[0] === "prescriptions" && parts.length >= 2) {
      const planId = parts[1];
      const current = store.get(planId);
      if (!current) return sendJson(response, 404, { error: "Không tìm thấy prescription plan." });

      if (request.method === "GET" && parts.length === 2) {
        return sendJson(response, 200, current);
      }

      if (request.method === "POST" && parts.length === 3 && parts[2] === "verify") {
        const body = await readJson(request);
        const next = verifyMedicationFields(current, body.medication_id, body.fields);
        return sendJson(response, 200, store.update(next));
      }

      if (request.method === "POST" && parts.length === 3 && parts[2] === "schedule") {
        const body = await readJson(request);
        const next = scheduleMedication(current, body.medication_id, body.times);
        return sendJson(response, 200, store.update(next));
      }
    }

    return sendJson(response, 404, { error: "Route không tồn tại." });
  } catch (error) {
    return sendJson(response, error.statusCode ?? 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`MediCare backend listening on http://localhost:${port}`);
});

