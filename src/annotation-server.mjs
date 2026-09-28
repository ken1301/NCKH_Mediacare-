import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateMedicationAnnotation } from './dataset/medication-annotation.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const labelRoot = path.resolve(process.env.ANNOTATION_LABEL_DIR ?? path.join(projectRoot, 'dataset/external/vaipe-p/public_train/label'));
const imageRoot = path.resolve(process.env.ANNOTATION_IMAGE_DIR ?? path.join(projectRoot, 'dataset/external/vaipe-p/public_train/image'));
const candidatePath = path.resolve(process.env.ANNOTATION_CANDIDATE_FILE ?? path.join(projectRoot, 'dataset/metadata/vaipe-p-baseline/medication-annotation-candidates.jsonl'));
const reviewRoot = path.resolve(process.env.ANNOTATION_REVIEW_DIR ?? path.join(projectRoot, 'dataset/working/medication-annotations'));
const staticRoot = path.join(projectRoot, 'web/annotation');
const port = Number(process.env.ANNOTATION_PORT ?? 4173);
const allowedAnnotators = new Set(['annotator-a', 'annotator-b', 'reviewer']);

function json(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function text(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, { 'content-type': contentType });
  response.end(body);
}

function routeParts(url) {
  return new URL(url, 'http://localhost').pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
}

function sampleId(value) {
  const result = String(value ?? '');
  if (!/^[A-Za-z0-9_.-]+$/.test(result)) throw Object.assign(new Error('sample_id không hợp lệ.'), { statusCode: 400 });
  return result;
}

function annotatorId(value) {
  const result = String(value ?? '');
  if (!allowedAnnotators.has(result)) throw Object.assign(new Error('annotator không hợp lệ.'), { statusCode: 400 });
  return result;
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) throw Object.assign(new Error('Request quá lớn.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body không phải JSON hợp lệ.'), { statusCode: 400 });
  }
}

async function readCandidates() {
  const result = new Map();
  try {
    const lines = (await readFile(candidatePath, 'utf8')).split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const item = JSON.parse(line);
      if (item.sample_id) result.set(item.sample_id, item);
    }
  } catch {
    // Candidate generation is optional; the UI can still review raw word boxes.
  }
  return result;
}

async function loadCorpus() {
  const candidates = await readCandidates();
  const files = (await readdir(labelRoot)).filter((file) => file.toLowerCase().endsWith('.json')).sort();
  const samples = new Map();
  for (const file of files) {
    const id = path.basename(file, path.extname(file));
    const rawWords = JSON.parse(await readFile(path.join(labelRoot, file), 'utf8'));
    samples.set(id, {
      sample_id: id,
      source_file: file,
      split: 'train',
      raw_words: rawWords,
      candidate: candidates.get(id) ?? null
    });
  }
  return samples;
}

async function readDraft(id, annotator) {
  try {
    return JSON.parse(await readFile(path.join(reviewRoot, annotator, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

function summary(sample, draft) {
  return {
    sample_id: sample.sample_id,
    source_file: sample.source_file,
    split: sample.split,
    raw_word_count: sample.raw_words.length,
    candidate_entity_count: sample.candidate?.candidate_entities?.length ?? 0,
    candidate_relation_count: sample.candidate?.candidate_relations?.length ?? 0,
    draft_status: draft?.annotation_status ?? 'unreviewed'
  };
}

async function stats(samples, annotator) {
  let saved = 0;
  let complete = 0;
  let needsReview = 0;
  let relations = 0;
  for (const sample of samples.values()) {
    const draft = await readDraft(sample.sample_id, annotator);
    if (!draft) continue;
    saved += 1;
    if (draft.annotation_status === 'complete') complete += 1;
    if (draft.annotation_status === 'needs_review') needsReview += 1;
    relations += Array.isArray(draft.relations) ? draft.relations.length : 0;
  }
  return { annotator, total_samples: samples.size, saved, complete, needs_review: needsReview, relations };
}

async function serveStatic(response, fileName, contentType) {
  try {
    const body = await readFile(path.join(staticRoot, fileName));
    response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    text(response, 404, 'Not found');
  }
}

const samples = await loadCorpus();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const parts = routeParts(request.url);

    if (request.method === 'GET' && parts.length === 1 && parts[0] === 'health') {
      return json(response, 200, { status: 'ok', service: 'medicare-annotation-studio', samples: samples.size });
    }

    if (request.method === 'GET' && parts[0] === 'api' && parts[1] === 'annotation' && parts[2] === 'samples' && parts.length === 3) {
      const annotator = annotatorId(url.searchParams.get('annotator') ?? 'annotator-a');
      const search = String(url.searchParams.get('search') ?? '').toLowerCase();
      const result = [];
      for (const sample of samples.values()) {
        if (search && !sample.sample_id.toLowerCase().includes(search)) continue;
        result.push(summary(sample, await readDraft(sample.sample_id, annotator)));
      }
      return json(response, 200, { samples: result, stats: await stats(samples, annotator) });
    }

    if (request.method === 'GET' && parts[0] === 'api' && parts[1] === 'annotation' && parts[2] === 'stats') {
      const annotator = annotatorId(url.searchParams.get('annotator') ?? 'annotator-a');
      return json(response, 200, await stats(samples, annotator));
    }

    if (parts[0] === 'api' && parts[1] === 'annotation' && parts[2] === 'samples' && parts.length >= 4) {
      const id = sampleId(parts[3]);
      const sample = samples.get(id);
      if (!sample) return json(response, 404, { error: 'Không tìm thấy sample.' });

      if (request.method === 'GET' && parts.length === 5 && parts[4] === 'image') {
        try {
          const image = await readFile(path.join(imageRoot, `${id}.png`));
          response.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
          return response.end(image);
        } catch {
          return json(response, 404, { error: 'Không tìm thấy ảnh sample.' });
        }
      }

      if (request.method === 'GET' && parts.length === 4) {
        const annotator = annotatorId(url.searchParams.get('annotator') ?? 'annotator-a');
        return json(response, 200, {
          ...sample,
          draft: await readDraft(id, annotator),
          image_url: `/api/annotation/samples/${encodeURIComponent(id)}/image`
        });
      }

      if (request.method === 'PUT' && parts.length === 4) {
        const body = await readJson(request);
        const annotator = annotatorId(body.annotator);
        const record = body.record;
        if (!record || record.sample_id !== id) return json(response, 400, { error: 'record.sample_id không khớp URL.' });
        const validation = validateMedicationAnnotation(record);
        if (!validation.valid) return json(response, 422, { error: 'Annotation không hợp lệ.', validation });
        await mkdir(path.join(reviewRoot, annotator), { recursive: true });
        await writeFile(path.join(reviewRoot, annotator, `${id}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
        return json(response, 200, { saved: true, annotator, sample_id: id, validation });
      }
    }

    if (request.method === 'GET' && url.pathname === '/') return serveStatic(response, 'index.html', 'text/html; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/app.js') return serveStatic(response, 'app.js', 'text/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/styles.css') return serveStatic(response, 'styles.css', 'text/css; charset=utf-8');
    return json(response, 404, { error: 'Route không tồn tại.' });
  } catch (error) {
    return json(response, error.statusCode ?? 500, { error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`MediCare Annotation Studio: http://127.0.0.1:${port}`);
  console.log(`Samples: ${samples.size}; review output: ${reviewRoot}`);
});
