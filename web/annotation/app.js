const ENTITY_LABELS = ['DRUG', 'STRENGTH', 'DOSE', 'FORM', 'ROUTE', 'FREQUENCY', 'DURATION', 'TIMING', 'INSTRUCTION'];
const RELATION_TYPES = ['HAS_STRENGTH', 'HAS_DOSE', 'HAS_FORM', 'HAS_ROUTE', 'HAS_FREQUENCY', 'HAS_DURATION', 'HAS_TIMING', 'HAS_INSTRUCTION'];
const COLORS = { drugname: '#c27f22', usage: '#96701f', other: '#7b8b94', diagnose: '#a85c6d', quantity: '#6f67a8', date: '#527ba0' };

const state = {
  annotator: localStorage.getItem('medicare-annotator') ?? 'annotator-a',
  samples: [],
  visibleSamples: [],
  currentIndex: -1,
  current: null,
  entities: [],
  relations: [],
  dirty: false,
  image: null,
  imageScale: 1,
  zoomMode: 'fit',
  selectedEntityId: null,
  saving: false
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
const api = async (url, options) => {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Request thất bại.');
  return payload;
};

function setStatus(message, type = '') {
  $('save-status').textContent = message;
  $('save-status').className = `save-status ${type}`;
}

function draftStatus(sample) {
  return sample?.draft_status ?? 'unreviewed';
}

function remapCandidate(candidate) {
  const entities = (candidate?.candidate_entities ?? []).map((entity, index) => ({
    id: `entity_${index + 1}`,
    label: ENTITY_LABELS.includes(entity.label) ? entity.label : 'INSTRUCTION',
    text: entity.text ?? '',
    bbox: Array.isArray(entity.bbox) ? [...entity.bbox] : [0, 0, 1, 1],
    needs_review: true,
    source_word_id: entity.source_word_id ?? null,
    source_label: entity.source_label ?? null,
    candidate_reason: entity.candidate_reason ?? null,
    included: true,
    candidate_id: entity.id
  }));
  const ids = new Map(entities.map((entity) => [entity.candidate_id, entity.id]));
  const relations = (candidate?.candidate_relations ?? []).map((relation) => ({
    id: `relation_${ids.size}_${Math.random().toString(16).slice(2, 7)}`,
    type: relation.type,
    source_entity_id: ids.get(relation.source_entity_id) ?? relation.source_entity_id,
    target_entity_id: ids.get(relation.target_entity_id) ?? relation.target_entity_id,
    needs_review: true
  })).filter((relation) => relation.source_entity_id && relation.target_entity_id);
  return { entities, relations };
}

function loadWorkingState(payload) {
  if (payload.draft) {
    state.entities = (payload.draft.entities ?? []).map((entity) => ({ ...entity, bbox: [...entity.bbox], included: true }));
    state.relations = (payload.draft.relations ?? []).map((relation) => ({ ...relation }));
    $('privacy-deidentified').checked = payload.draft.privacy?.de_identified === true;
    $('privacy-reviewed').checked = payload.draft.privacy?.reviewed === true;
    $('privacy-approved').checked = payload.draft.privacy?.approved_for_research === true;
    $('mark-complete').checked = payload.draft.annotation_status === 'complete';
    $('review-notes').value = payload.draft.review?.notes?.join('\n') ?? '';
  } else {
    const initial = remapCandidate(payload.candidate);
    state.entities = initial.entities;
    state.relations = initial.relations;
    $('privacy-deidentified').checked = false;
    $('privacy-reviewed').checked = false;
    $('privacy-approved').checked = false;
    $('mark-complete').checked = false;
    $('review-notes').value = '';
  }
  state.dirty = false;
  state.selectedEntityId = null;
  state.zoomMode = 'fit';
  $('dirty-badge').textContent = payload.draft ? 'Saved' : 'Draft';
  $('dirty-badge').className = `draft-badge${payload.draft ? ' saved' : ''}`;
}

function markDirty() {
  state.dirty = true;
  $('dirty-badge').textContent = 'Unsaved';
  $('dirty-badge').className = 'draft-badge unsaved';
  setStatus('Có thay đổi chưa lưu');
  drawCanvas();
}

function optionHtml(options, selected) {
  return options.map((option) => `<option value="${escapeHtml(option)}" ${option === selected ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('');
}

function renderEntities() {
  const list = $('entity-list');
  $('entity-count').textContent = state.entities.filter((entity) => entity.included !== false).length;
  list.innerHTML = state.entities.map((entity, index) => `
    <article class="entity-card ${entity.included === false ? 'excluded' : ''} ${state.selectedEntityId === entity.id ? 'selected' : ''}" data-entity-index="${index}">
      <div class="entity-card-head">
        <input type="checkbox" data-action="toggle-entity" ${entity.included !== false ? 'checked' : ''} aria-label="Giữ entity ${index + 1}" />
        <select data-action="entity-label" aria-label="Label entity ${index + 1}">${optionHtml(ENTITY_LABELS, entity.label)}</select>
        <button class="focus-entity" type="button" data-action="focus-entity" aria-pressed="${state.selectedEntityId === entity.id}" aria-label="Soi entity ${index + 1} trên ảnh">◎</button>
        <button type="button" data-action="remove-entity" aria-label="Xóa entity ${index + 1}">×</button>
      </div>
      <input class="entity-text" data-action="entity-text" value="${escapeHtml(entity.text)}" aria-label="Text entity ${index + 1}" />
      <div class="entity-source">Nguồn: ${escapeHtml(entity.source_label ?? 'manual')} · word ${escapeHtml(entity.source_word_id ?? '—')}</div>
      <div class="bbox-grid">
        ${['x1', 'y1', 'x2', 'y2'].map((key, bboxIndex) => `<label>${key}<input type="number" step="1" data-action="bbox" data-bbox-index="${bboxIndex}" value="${Number(entity.bbox[bboxIndex] ?? 0)}" /></label>`).join('')}
      </div>
    </article>
  `).join('') || '<p class="helper-text">Chưa có entity. Chọn word box rồi thêm entity.</p>';
  list.querySelectorAll('[data-action]').forEach((control) => control.addEventListener('change', onEntityChange));
  list.querySelectorAll('[data-action="focus-entity"]').forEach((button) => button.addEventListener('click', onFocusEntity));
  list.querySelectorAll('[data-action="remove-entity"]').forEach((button) => button.addEventListener('click', onRemoveEntity));
}

function onFocusEntity(event) {
  const card = event.target.closest('[data-entity-index]');
  const entity = state.entities[Number(card.dataset.entityIndex)];
  state.selectedEntityId = state.selectedEntityId === entity.id ? null : entity.id;
  renderEntities();
  drawCanvas();
}

function onEntityChange(event) {
  const card = event.target.closest('[data-entity-index]');
  const index = Number(card.dataset.entityIndex);
  const entity = state.entities[index];
  const action = event.target.dataset.action;
  if (action === 'toggle-entity') entity.included = event.target.checked;
  if (action === 'entity-label') entity.label = event.target.value;
  if (action === 'entity-text') entity.text = event.target.value;
  if (action === 'bbox') entity.bbox[Number(event.target.dataset.bboxIndex)] = Number(event.target.value);
  markDirty();
  renderRelations();
  renderEntityControls();
}

function onRemoveEntity(event) {
  const card = event.target.closest('[data-entity-index]');
  const id = state.entities[Number(card.dataset.entityIndex)].id;
  if (state.selectedEntityId === id) state.selectedEntityId = null;
  state.entities.splice(Number(card.dataset.entityIndex), 1);
  state.relations = state.relations.filter((relation) => relation.source_entity_id !== id && relation.target_entity_id !== id);
  const idMap = new Map(state.entities.map((entity, index) => [entity.id, `entity_${index + 1}`]));
  state.entities.forEach((entity, index) => { entity.id = `entity_${index + 1}`; });
  state.relations.forEach((relation) => {
    relation.source_entity_id = idMap.get(relation.source_entity_id) ?? relation.source_entity_id;
    relation.target_entity_id = idMap.get(relation.target_entity_id) ?? relation.target_entity_id;
  });
  markDirty();
  renderEntities();
  renderRelations();
}

function renderEntityControls() {
  const included = state.entities.filter((entity) => entity.included !== false);
  const options = included.map((entity) => `<option value="${escapeHtml(entity.id)}">${escapeHtml(entity.label)} · ${escapeHtml(entity.text.slice(0, 26))}</option>`).join('');
  $('relation-source').innerHTML = options;
  $('relation-target').innerHTML = options;
  const words = state.current?.raw_words ?? [];
  $('new-entity-word').innerHTML = words.map((word) => `<option value="${escapeHtml(word.id)}">#${escapeHtml(word.id)} · ${escapeHtml(word.text.slice(0, 30))}</option>`).join('');
  $('new-entity-label').innerHTML = optionHtml(ENTITY_LABELS, 'DRUG');
  if (words[0] && !$('new-entity-text').value) $('new-entity-text').value = words[0].text ?? '';
}

function renderRelations() {
  $('relation-count-current').textContent = state.relations.length;
  const byId = new Map(state.entities.map((entity) => [entity.id, entity]));
  $('relation-list').innerHTML = state.relations.map((relation, index) => {
    const source = byId.get(relation.source_entity_id);
    const target = byId.get(relation.target_entity_id);
    return `<div class="relation-row"><div class="relation-copy"><strong>${escapeHtml(source?.text ?? relation.source_entity_id)}</strong> <span>${escapeHtml(relation.type)}</span> <strong>${escapeHtml(target?.text ?? relation.target_entity_id)}</strong><small>${relation.needs_review ? 'needs_review' : 'reviewed'}</small></div><button type="button" data-relation-index="${index}" aria-label="Xóa relation">×</button></div>`;
  }).join('') || '<p class="helper-text">Chưa có relation.</p>';
  $('relation-list').querySelectorAll('[data-relation-index]').forEach((button) => button.addEventListener('click', () => {
    state.relations.splice(Number(button.dataset.relationIndex), 1);
    markDirty();
    renderRelations();
  }));
}

function renderRawWords() {
  const words = state.current?.raw_words ?? [];
  $('word-count').textContent = words.length;
  $('raw-word-table').innerHTML = words.map((word) => `<tr><td>${escapeHtml(word.id)}</td><td>${escapeHtml(word.text)}</td><td>${escapeHtml(word.label)}</td><td>[${word.box.join(', ')}]</td></tr>`).join('');
}

function renderInspector() {
  $('inspector-empty').hidden = Boolean(state.current);
  $('inspector-content').hidden = !state.current;
  if (!state.current) return;
  renderEntities();
  renderEntityControls();
  renderRelations();
  renderRawWords();
}

function drawCanvas() {
  const canvas = $('prescription-canvas');
  const viewport = $('canvas-viewport');
  const zoomLabel = $('zoom-label');
  const hasImage = Boolean(state.image && state.current);
  if (!state.image || !state.current) {
    canvas.hidden = true;
    viewport.hidden = true;
    $('empty-stage').hidden = false;
    $('canvas-legend').hidden = true;
    ['zoom-out-button', 'zoom-in-button', 'fit-button'].forEach((id) => { $(id).disabled = true; });
    zoomLabel.textContent = 'Fit';
    return;
  }
  canvas.hidden = false;
  viewport.hidden = false;
  $('empty-stage').hidden = true;
  $('canvas-legend').hidden = false;
  ['zoom-out-button', 'zoom-in-button', 'fit-button'].forEach((id) => { $(id).disabled = !hasImage; });
  const image = state.image;
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.style.width = `${Math.round(image.naturalWidth * state.imageScale)}px`;
  canvas.style.height = `${Math.round(image.naturalHeight * state.imageScale)}px`;
  zoomLabel.textContent = state.zoomMode === 'fit' ? 'Fit' : `${Math.round(state.imageScale * 100)}%`;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  context.lineWidth = Math.max(2, image.naturalWidth / 700);
  for (const word of state.current.raw_words) {
    const [x1, y1, x2, y2] = word.box;
    context.strokeStyle = COLORS[word.label] ?? '#809097';
    context.fillStyle = `${COLORS[word.label] ?? '#809097'}22`;
    context.fillRect(x1, y1, x2 - x1, y2 - y1);
    context.strokeRect(x1, y1, x2 - x1, y2 - y1);
  }
  for (const entity of state.entities.filter((item) => item.included !== false)) {
    const [x1, y1, x2, y2] = entity.bbox;
    const selected = entity.id === state.selectedEntityId;
    context.strokeStyle = selected ? '#be5c35' : '#087d74';
    context.lineWidth = selected ? Math.max(5, image.naturalWidth / 360) : Math.max(3, image.naturalWidth / 500);
    context.strokeRect(x1, y1, x2 - x1, y2 - y1);
    context.fillStyle = selected ? '#be5c3528' : '#087d7428';
    context.fillRect(x1, y1, x2 - x1, y2 - y1);
  }
}

function fitCanvas() {
  if (!state.image || !state.current) return;
  const viewport = $('canvas-viewport');
  const availableWidth = Math.max(260, viewport.clientWidth - 24);
  const availableHeight = Math.max(300, window.innerHeight - 350);
  state.imageScale = Math.min(1, availableWidth / state.image.naturalWidth, availableHeight / state.image.naturalHeight);
  state.zoomMode = 'fit';
  drawCanvas();
}

function adjustZoom(delta) {
  if (!state.image || !state.current) return;
  state.zoomMode = 'manual';
  state.imageScale = Math.min(3, Math.max(0.4, state.imageScale + delta));
  drawCanvas();
}

async function loadSamples() {
  const payload = await api(`/api/annotation/samples?annotator=${encodeURIComponent(state.annotator)}`);
  state.samples = payload.samples;
  $('saved-count').textContent = payload.stats.saved;
  $('relation-count').textContent = payload.stats.relations;
  renderSampleList();
}

function filteredSamples() {
  const search = $('sample-search').value.trim().toLowerCase();
  const filter = $('sample-filter').value;
  return state.samples.filter((sample) => {
    const matchesSearch = !search || sample.sample_id.toLowerCase().includes(search);
    const matchesFilter = filter === 'all' || draftStatus(sample) === filter;
    return matchesSearch && matchesFilter;
  });
}

function renderSampleList() {
  state.visibleSamples = filteredSamples();
  const list = $('sample-list');
  list.scrollTop = 0;
  $('sample-count').textContent = state.visibleSamples.length;
  list.setAttribute('aria-label', `${state.visibleSamples.length} sample đang hiển thị`);
  renderSampleWindow();
}

function renderSampleWindow() {
  const list = $('sample-list');
  const visible = state.visibleSamples;
  const rowHeight = 57;
  const overscan = 8;
  const start = Math.max(0, Math.floor(list.scrollTop / rowHeight) - overscan);
  const end = Math.min(visible.length, Math.ceil((list.scrollTop + list.clientHeight) / rowHeight) + overscan);
  const topSpacer = start * rowHeight;
  const bottomSpacer = Math.max(0, (visible.length - end) * rowHeight);
  const rows = visible.slice(start, end);
  $('sample-count').textContent = visible.length;
  list.innerHTML = visible.length
    ? `<div class="virtual-spacer" style="height:${topSpacer}px" aria-hidden="true"></div>${rows.map((sample) => `<button class="sample-item" type="button" role="option" aria-selected="${state.current?.sample_id === sample.sample_id}" data-sample-id="${escapeHtml(sample.sample_id)}"><span class="sample-item-marker" aria-hidden="true"></span><span><span class="sample-id">${escapeHtml(sample.sample_id)}</span><span class="sample-meta">${sample.raw_word_count} words · ${sample.candidate_relation_count} candidates</span></span><span class="sample-status ${escapeHtml(sample.draft_status)}">${escapeHtml(sample.draft_status)}</span></button>`).join('')}<div class="virtual-spacer" style="height:${bottomSpacer}px" aria-hidden="true"></div>`
    : '<p class="helper-text" style="padding:16px">Không tìm thấy sample.</p>';
  list.querySelectorAll('[data-sample-id]').forEach((button) => button.addEventListener('click', () => loadSample(button.dataset.sampleId)));
}

async function confirmDiscard() {
  if (!state.dirty) return true;
  return window.confirm('Mẫu hiện tại có thay đổi chưa lưu. Bạn muốn rời mẫu và bỏ thay đổi này không?');
}

async function loadSample(id) {
  const index = state.samples.findIndex((sample) => sample.sample_id === id);
  if (index < 0) return;
  if (state.current?.sample_id === id) return;
  if (!(await confirmDiscard())) return;
  const payload = await api(`/api/annotation/samples/${encodeURIComponent(id)}?annotator=${encodeURIComponent(state.annotator)}`);
  state.currentIndex = index;
  state.current = payload;
  $('sample-kicker').textContent = `${payload.split.toUpperCase()} · ${payload.source_file}`;
  $('sample-title').textContent = payload.sample_id;
  $('new-entity-text').value = '';
  const image = new Image();
  image.onload = () => { state.image = image; drawCanvas(); fitCanvas(); };
  image.onerror = () => setStatus('Không tải được ảnh sample.', 'error');
  image.src = `${payload.image_url}?t=${Date.now()}`;
  loadWorkingState(payload);
  renderInspector();
  renderSampleList();
  setStatus(payload.draft ? 'Đã tải bản lưu' : 'Candidate draft chưa review');
}

function moveSample(delta) {
  if (!state.samples.length) return;
  const next = Math.max(0, Math.min(state.samples.length - 1, state.currentIndex + delta));
  return loadSample(state.samples[next].sample_id);
}

async function loadNextPending() {
  const start = state.currentIndex >= 0 ? state.currentIndex + 1 : 0;
  const ordered = [...state.samples.slice(start), ...state.samples.slice(0, start)];
  const next = ordered.find((sample) => draftStatus(sample) !== 'complete');
  if (!next) return setStatus('Không còn sample cần review.', 'success');
  await loadSample(next.sample_id);
}

function addEntity() {
  const word = state.current?.raw_words.find((item) => String(item.id) === String($('new-entity-word').value));
  if (!word) return setStatus('Chọn word box nguồn trước.', 'error');
  const text = $('new-entity-text').value.trim() || word.text;
  state.entities.push({ id: `entity_${state.entities.length + 1}`, label: $('new-entity-label').value, text, bbox: [...word.box], needs_review: true, source_word_id: word.id, source_label: word.label, included: true });
  markDirty();
  renderEntities();
  renderEntityControls();
  setStatus('Đã thêm entity, chưa lưu');
}

function addRelation() {
  const source = $('relation-source').value;
  const target = $('relation-target').value;
  const type = $('relation-type').value;
  if (!source || !target || source === target) return setStatus('Relation cần source và target khác nhau.', 'error');
  const sourceEntity = state.entities.find((entity) => entity.id === source);
  const targetEntity = state.entities.find((entity) => entity.id === target);
  if (sourceEntity?.label !== 'DRUG') return setStatus('Source relation phải là DRUG.', 'error');
  const expected = type.replace('HAS_', '');
  if (targetEntity?.label !== expected) return setStatus(`Target của ${type} phải là ${expected}.`, 'error');
  if (state.relations.some((relation) => relation.type === type && relation.source_entity_id === source && relation.target_entity_id === target)) return setStatus('Relation này đã tồn tại.', 'error');
  state.relations.push({ id: `relation_${state.relations.length + 1}`, type, source_entity_id: source, target_entity_id: target, needs_review: true });
  markDirty();
  renderRelations();
  setStatus('Đã thêm relation, chưa lưu');
}

function recordForSave() {
  const included = state.entities.filter((entity) => entity.included !== false);
  const includedIds = new Set(included.map((entity) => entity.id));
  const complete = $('mark-complete').checked;
  const entities = included.map(({ included, source_word_id, source_label, candidate_reason, candidate_id, ...entity }) => ({ ...entity, needs_review: complete ? false : entity.needs_review !== false }));
  const relations = state.relations.filter((relation) => includedIds.has(relation.source_entity_id) && includedIds.has(relation.target_entity_id)).map((relation) => ({ ...relation, needs_review: complete ? false : relation.needs_review !== false }));
  return {
    schema_version: 'medication.annotation.v1',
    sample_id: state.current.sample_id,
    image: { file_name: `${state.current.sample_id}.png`, width: state.image?.naturalWidth ?? null, height: state.image?.naturalHeight ?? null, difficulty: 'unknown' },
    privacy: { de_identified: $('privacy-deidentified').checked, reviewed: $('privacy-reviewed').checked, approved_for_research: $('privacy-approved').checked },
    split: state.current.split,
    entities,
    relations,
    annotation_status: $('mark-complete').checked ? 'complete' : 'needs_review',
    review: { annotator_id: state.annotator, reviewer_id: state.annotator === 'reviewer' ? 'reviewer' : null, notes: $('review-notes').value.split('\n').map((line) => line.trim()).filter(Boolean) }
  };
}

async function saveAnnotation() {
  if (!state.current || state.saving) return;
  state.saving = true;
  $('save-button').disabled = true;
  $('save-button').textContent = 'Đang lưu…';
  const record = recordForSave();
  setStatus('Đang lưu…');
  try {
    const result = await api(`/api/annotation/samples/${encodeURIComponent(state.current.sample_id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ annotator: state.annotator, record }) });
    state.dirty = false;
    $('dirty-badge').textContent = 'Saved';
    $('dirty-badge').className = 'draft-badge saved';
    setStatus(`Đã lưu · ${result.validation.warnings.length} warning`, 'success');
    await loadSamples();
    renderSampleList();
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    state.saving = false;
    $('save-button').disabled = false;
    $('save-button').textContent = 'Lưu annotation';
  }
}

function setupEvents() {
  $('annotator-select').value = state.annotator;
  $('annotator-select').addEventListener('change', async (event) => {
    if (!(await confirmDiscard())) {
      event.target.value = state.annotator;
      return;
    }
    state.annotator = event.target.value;
    localStorage.setItem('medicare-annotator', state.annotator);
    await loadSamples();
    if (state.current) {
      const currentId = state.current.sample_id;
      state.current = null;
      state.image = null;
      await loadSample(currentId);
    }
  });
  $('sample-search').addEventListener('input', renderSampleList);
  $('sample-filter').addEventListener('change', renderSampleList);
  $('sample-list').addEventListener('scroll', renderSampleWindow, { passive: true });
  $('next-pending-button').addEventListener('click', loadNextPending);
  $('previous-button').addEventListener('click', () => moveSample(-1));
  $('next-button').addEventListener('click', () => moveSample(1));
  $('zoom-out-button').addEventListener('click', () => adjustZoom(-0.2));
  $('zoom-in-button').addEventListener('click', () => adjustZoom(0.2));
  $('fit-button').addEventListener('click', fitCanvas);
  $('add-entity-button').addEventListener('click', addEntity);
  $('add-relation-button').addEventListener('click', addRelation);
  $('relation-type').innerHTML = optionHtml(RELATION_TYPES, 'HAS_STRENGTH');
  $('save-button').addEventListener('click', saveAnnotation);
  ['privacy-deidentified', 'privacy-reviewed', 'privacy-approved', 'mark-complete', 'review-notes'].forEach((id) => $(id).addEventListener('change', markDirty));
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveAnnotation(); }
    if (event.target.matches('input, textarea, select')) return;
    if (event.key === 'ArrowLeft') moveSample(-1);
    if (event.key === 'ArrowRight') moveSample(1);
  });
  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  window.addEventListener('resize', () => {
    if (state.zoomMode === 'fit') fitCanvas();
  });
}

setupEvents();
loadSamples().catch((error) => setStatus(error.message, 'error'));
