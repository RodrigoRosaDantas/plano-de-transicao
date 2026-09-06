const POST_EXAM_V27 = {
  version: 27,
  noteKey: 'plano-transicao:post-exam-v27:notes',
  officialUrl: 'https://quadrix.org.br/informacoes/3056/',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Centro%20de%20Ensino%20Fundamental%20Telebras%C3%ADlia%20Riacho%20Fundo%20I%20Bras%C3%ADlia%20DF',
  venue: 'Centro de Ensino Fundamental Telebrasília — Riacho Fundo I',
  address: 'QN 1, Área Especial 1, Lote 01/02, Praça Central, Riacho Fundo I — Brasília/DF',
  turns: {
    edas: { label: 'EDAS · manhã', role: 'Administrador', cargo: 'Cargo 400', open: '06:45', close: '07:45', room: '1820', floor: 'T' },
    tdas: { label: 'TDAS · tarde', role: 'Técnico Administrativo', cargo: 'Cargo 202', open: '13:45', close: '14:45', room: '1830', floor: '1' },
  },
};

let postExamSnapshot = window.__planoPublishedSnapshot || null;
let postExamQueued = false;

const v27Esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const v27Fmt = (value) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));
const v27Pct = (value) => value == null ? '—' : `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function v27Icon(name) {
  const paths = {
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    file: '<path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
    note: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h6M8 17h4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m14 10 6-6"/>',
    external: '<path d="M14 3h7v7m0-7-9 9"/><path d="M18 13v7H4V6h7"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    map: '<path d="M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Z"/><circle cx="12" cy="9" r="2"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.check}</svg>`;
}

function v27SedesExams(data = postExamSnapshot) {
  return (data?.exams || []).filter((exam) => String(exam.id || '').startsWith('sedes-2026-'));
}

function v27IsPostExam(data = postExamSnapshot) {
  if (data?.meta?.phase === 'post-exam') return true;
  const exams = v27SedesExams(data);
  return exams.length === 2 && exams.every((exam) => exam.attendance === 'completed');
}

function v27Exam(id, data = postExamSnapshot) {
  return v27SedesExams(data).find((exam) => exam.id === `sedes-2026-${id}`) || null;
}

function v27HasResult(exam) {
  return exam?.rawAccuracy != null || (exam?.score && exam.score !== '—');
}

function v27HasRanking(exam) {
  return Boolean(exam?.ranking && exam.ranking !== '—');
}

function v27ReadNotes() {
  try {
    const value = JSON.parse(localStorage.getItem(POST_EXAM_V27.noteKey) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function v27WriteNotes(notes) {
  try {
    localStorage.setItem(POST_EXAM_V27.noteKey, JSON.stringify({ ...notes, updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

function v27SnapshotLabel(data = postExamSnapshot) {
  if (!data?.meta?.generatedAt) return 'snapshot publicado';
  const date = new Date(data.meta.generatedAt);
  if (Number.isNaN(date.getTime())) return 'snapshot publicado';
  return `Atualizado ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date)}`;
}

function v27Phase(data = postExamSnapshot) {
  const edas = v27Exam('edas', data);
  const tdas = v27Exam('tdas', data);
  const notes = v27ReadNotes();
  const notesDone = Boolean(String(notes.edas || '').trim() || String(notes.tdas || '').trim());
  const resultKnown = [edas, tdas].some(v27HasResult);
  const rankingKnown = [edas, tdas].some(v27HasRanking);
  return {
    notesDone,
    resultKnown,
    rankingKnown,
    current: rankingKnown ? 'Resultado em acompanhamento' : resultKnown ? 'Conferência e recursos' : 'Aguardando gabarito e correção',
  };
}

function v27UpgradeNavigation() {
  document.querySelectorAll('[data-exam-day-tab]').forEach((button) => {
    const main = button.querySelector('b');
    const small = button.querySelector('small');
    if (main) main.textContent = 'Pós-prova';
    if (small) small.textContent = button.closest('#moreSheet') ? 'gabarito, recursos e resultado' : 'Pós-prova';
    button.setAttribute('aria-label', 'Abrir pós-prova da SEDES/DF');
    button.dataset.postExamTab = '27';
  });
}

function v27UpgradeMission(data = postExamSnapshot) {
  const missionTitle = document.getElementById('missionTitle');
  const missionText = document.getElementById('missionText');
  const milestone = document.getElementById('nextMilestone');
  if (missionTitle) missionTitle.innerHTML = 'Provas concluídas. <em>Agora, transformar correção em decisão.</em>';
  if (missionText) missionText.textContent = data?.mission || 'Transformar as provas realizadas em diagnóstico, correção, recursos, resultado e próxima decisão de carreira.';
  if (milestone) {
    const label = milestone.querySelector('span');
    const strong = milestone.querySelector('strong');
    const small = milestone.querySelector('small');
    if (label) label.textContent = 'Próximo marco';
    if (strong) strong.textContent = 'GABARITO';
    if (small) small.textContent = 'correção · recursos · resultado';
    milestone.classList.add('v27-next-milestone');
  }
}

function v27HomeSummary(data = postExamSnapshot) {
  const edas = v27Exam('edas', data);
  const tdas = v27Exam('tdas', data);
  const phase = v27Phase(data);
  return `
    <div class="countdown-topline"><span class="section-kicker">${v27Icon('check')} SEDES/DF · 06/09/2026</span><span class="v27-complete-badge">2 de 2 realizadas</span></div>
    <div class="v27-home-main">
      <div><span class="eyebrow">PÓS-PROVA</span><h2>As duas provas foram realizadas.</h2><p>EDAS · manhã ✓ &nbsp;·&nbsp; TDAS · tarde ✓</p></div>
      <div class="v27-home-phase"><small>Etapa atual</small><strong>${v27Esc(phase.current)}</strong><span>${v27Esc(v27SnapshotLabel(data))}</span></div>
    </div>
    <div class="v27-home-actions">
      <button class="primary-button" type="button" data-exam-day-tab>${v27Icon('target')} Abrir pós-prova</button>
      <button class="secondary-button" type="button" data-view="exams">${v27Icon('file')} Ver registros</button>
    </div>`;
}

function v27UpgradeHome(data = postExamSnapshot) {
  const root = document.querySelector('.command-view');
  if (!root) return;
  document.body.classList.add('post-exam-v27');

  const countdown = root.querySelector('.countdown-card');
  if (countdown && countdown.dataset.postExamV27 !== '1') {
    countdown.dataset.postExamV27 = '1';
    countdown.classList.add('v27-home-status');
    countdown.innerHTML = v27HomeSummary(data);
  }

  const targetCards = [...root.querySelectorAll('.target-card')];
  const tdas = data?.metrics?.tdas;
  const edas = data?.metrics?.edas;
  if (targetCards[0] && tdas) {
    targetCards[0].classList.add('v27-history-target');
    const small = targetCards[0].querySelector('.target-card-main small');
    const title = targetCards[0].querySelector('.target-card-main h2');
    if (small) small.textContent = 'Histórico TDAS · preparação encerrada';
    if (title) title.textContent = `${v27Fmt(tdas.questions)} questões mensuráveis`;
  }
  if (targetCards[1] && edas) {
    targetCards[1].classList.add('v27-history-target');
    const small = targetCards[1].querySelector('.target-card-main small');
    const title = targetCards[1].querySelector('.target-card-main h2');
    if (small) small.textContent = 'Histórico EDAS · preparação encerrada';
    if (title) title.textContent = `${v27Fmt(edas.questions)} questões mensuráveis`;
  }

  const action = root.querySelector('.action-card');
  if (action && action.dataset.postExamV27 !== '1') {
    action.dataset.postExamV27 = '1';
    action.classList.add('v27-next-action');
    action.innerHTML = `
      <div><span class="eyebrow">PRÓXIMOS PASSOS</span><h2>Corrigir, recorrer e acompanhar — nessa ordem.</h2></div>
      <p>Sem nota inventada. O fluxo agora é <strong>gabarito → conferência → recursos → nota → classificação</strong>.</p>
      <div class="command-actions">
        <button class="primary-button" type="button" data-exam-day-tab>${v27Icon('target')} Abrir pós-prova</button>
        <button class="secondary-button" type="button" data-view="exams">${v27Icon('file')} Resultados</button>
        <button class="secondary-button" type="button" data-view="strategy">${v27Icon('chevron')} Próxima decisão</button>
      </div>`;
  }

  const journey = root.querySelector('.journey-mini');
  if (journey && journey.dataset.postExamV27 !== '1') {
    journey.dataset.postExamV27 = '1';
    const kicker = journey.querySelector('.eyebrow');
    const heading = journey.querySelector('h2');
    if (kicker) kicker.textContent = 'JORNADA DA TRANSIÇÃO';
    if (heading) heading.textContent = 'A SEDES/DF virou marco concluído; a próxima fase é resultado.';
    const nodes = journey.querySelectorAll('.journey-node');
    nodes.forEach((node, index) => {
      node.classList.toggle('done', index <= 4);
      node.classList.toggle('active', index === 5);
    });
  }
}

function v27Step(label, state, detail) {
  return `<article class="v27-step ${state}"><span>${state === 'done' ? v27Icon('check') : state === 'current' ? v27Icon('target') : '○'}</span><div><strong>${v27Esc(label)}</strong><small>${v27Esc(detail)}</small></div></article>`;
}

function v27ExamCard(id, data = postExamSnapshot) {
  const spec = POST_EXAM_V27.turns[id];
  const exam = v27Exam(id, data);
  const result = v27HasResult(exam);
  const ranking = v27HasRanking(exam);
  return `<article class="exam21-turn v27-exam-card v27-exam-card--${id}">
    <div class="v27-exam-head"><div><span>${v27Esc(spec.label)}</span><h3>${v27Esc(spec.role)}</h3><small>${v27Esc(spec.cargo)}</small></div><span class="v27-done-chip">${v27Icon('check')} Realizada</span></div>
    <div class="v27-exam-result"><small>Correção</small><strong>${result ? v27Pct(exam.rawAccuracy) : 'Aguardando gabarito'}</strong><span>${ranking ? v27Esc(exam.ranking) : 'Classificação ainda não registrada'}</span></div>
    <div class="v27-exam-actions"><button type="button" data-view="exams">Abrir registros ${v27Icon('chevron')}</button>${exam?.sourceUrl ? `<a href="${v27Esc(exam.sourceUrl)}" target="_blank" rel="noreferrer">Fonte ${v27Icon('external')}</a>` : ''}</div>
  </article>`;
}

function v27NotesPanel() {
  const notes = v27ReadNotes();
  return `<details class="v27-disclosure v27-notes" id="v27Notes">
    <summary><span>${v27Icon('note')}</span><div><strong>Memória das provas</strong><small>Guarde impressões por cargo; fica somente neste navegador.</small></div>${v27Icon('chevron')}</summary>
    <div class="v27-disclosure-body">
      <label><span><b>EDAS · manhã</b><small>Administrador</small></span><textarea maxlength="2000" data-v27-note="edas" placeholder="Objetiva, estudo de caso, tempo, questões marcantes…">${v27Esc(notes.edas || '')}</textarea><em data-v27-count="edas">${String(notes.edas || '').length}/2.000</em></label>
      <label><span><b>TDAS · tarde</b><small>Técnico Administrativo</small></span><textarea maxlength="2000" data-v27-note="tdas" placeholder="Objetiva, redação, tempo, questões marcantes…">${v27Esc(notes.tdas || '')}</textarea><em data-v27-count="tdas">${String(notes.tdas || '').length}/2.000</em></label>
      <div class="v27-note-actions"><span id="v27NoteState">${notes.updatedAt ? 'Anotações salvas neste navegador.' : 'Ainda sem anotações salvas.'}</span><button class="primary-button" type="button" data-v27-save-notes>Salvar anotações</button></div>
    </div>
  </details>`;
}

function v27ArchivePanel() {
  return `<details class="v27-disclosure v27-archive" id="v27Archive">
    <summary><span>${v27Icon('map')}</span><div><strong>Registro do dia da prova</strong><small>Local, portões, salas, checklist e fontes ficam preservados sem ocupar a tela principal.</small></div>${v27Icon('chevron')}</summary>
    <div class="v27-disclosure-body">
      <div class="v27-archive-location"><span>${v27Icon('map')}</span><div><strong>${v27Esc(POST_EXAM_V27.venue)}</strong><p>${v27Esc(POST_EXAM_V27.address)}</p></div><a href="${POST_EXAM_V27.mapsUrl}" target="_blank" rel="noreferrer">Abrir rota ${v27Icon('external')}</a></div>
      <div class="v27-archive-grid">
        <article><span>EDAS · manhã</span><strong>Portões ${POST_EXAM_V27.turns.edas.open}–${POST_EXAM_V27.turns.edas.close}</strong><small>Sala ${POST_EXAM_V27.turns.edas.room} · bloco 1 · andar ${POST_EXAM_V27.turns.edas.floor} · duração 4 horas</small></article>
        <article><span>TDAS · tarde</span><strong>Portões ${POST_EXAM_V27.turns.tdas.open}–${POST_EXAM_V27.turns.tdas.close}</strong><small>Sala ${POST_EXAM_V27.turns.tdas.room} · bloco 1 · andar ${POST_EXAM_V27.turns.tdas.floor} · duração 4 horas</small></article>
      </div>
      <p class="v27-archive-note">O horário nominal de início não foi divulgado oficialmente. O histórico pré-prova permanece apenas como registro; CCI e edital prevalecem sobre qualquer resumo.</p>
      <div class="v27-archive-actions"><a href="${POST_EXAM_V27.officialUrl}" target="_blank" rel="noreferrer">Página oficial da Quadrix ${v27Icon('external')}</a><button type="button" data-v27-print>Imprimir / salvar PDF</button></div>
    </div>
  </details>`;
}

function v27PostExamTemplate(data = postExamSnapshot) {
  const phase = v27Phase(data);
  const edas = v27Exam('edas', data);
  const tdas = v27Exam('tdas', data);
  const resultKnown = [edas, tdas].some(v27HasResult);
  const rankingKnown = [edas, tdas].some(v27HasRanking);
  return `<div class="exam21-shell post-exam-v27-shell" data-exam21-view data-post-exam-v27>
    <section class="exam21-hero v27-hero">
      <div class="v27-hero-copy">
        <div class="v27-kicker">${v27Icon('check')} SEDES/DF · 06/09/2026 · 2 DE 2 REALIZADAS</div>
        <h2>Provas concluídas. <em>Agora, gabarito, recursos e resultado.</em></h2>
        <p>EDAS pela manhã e TDAS à tarde estão registradas como realizadas. Nota e classificação continuam vazias até existir dado de correção.</p>
        <div class="v27-hero-actions"><button class="primary-button" type="button" data-view="exams">${v27Icon('file')} Abrir registros</button><button class="secondary-button" type="button" data-v27-copy-summary>${v27Icon('copy')} Copiar resumo</button><a class="secondary-button" href="${POST_EXAM_V27.officialUrl}" target="_blank" rel="noreferrer">Quadrix ${v27Icon('external')}</a></div>
      </div>
      <aside class="v27-phase-card"><small>ETAPA ATUAL</small><strong>${v27Esc(phase.current)}</strong><span>${v27Esc(v27SnapshotLabel(data))}</span></aside>
    </section>

    <section class="v27-next-panel panel">
      <div class="v27-section-head"><div><span class="eyebrow">PRÓXIMOS PASSOS</span><h3>Da memória da prova até a classificação.</h3></div><span class="v27-section-chip">sem preencher lacunas</span></div>
      <div class="v27-steps">
        ${v27Step('Impressões', phase.notesDone ? 'done' : 'current', phase.notesDone ? 'Registradas neste navegador' : 'Registre enquanto estiver fresco')}
        ${v27Step('Gabarito', resultKnown ? 'done' : phase.notesDone ? 'current' : 'pending', resultKnown ? 'Correção já registrada' : 'Aguardar publicação oficial')}
        ${v27Step('Recursos', 'pending', 'Mapear somente após conferir itens')}
        ${v27Step('Nota', resultKnown ? 'done' : 'pending', resultKnown ? 'Há dado de correção' : 'Não registrar antes da correção')}
        ${v27Step('Resultado', rankingKnown ? 'done' : 'pending', rankingKnown ? 'Classificação registrada' : 'Acompanhar classificação oficial')}
      </div>
    </section>

    <section class="exam21-turns v27-exam-grid" id="exam21Turns">${v27ExamCard('edas', data)}${v27ExamCard('tdas', data)}</section>

    ${v27NotesPanel()}
    ${v27ArchivePanel()}
  </div>`;
}

function v27BindPostExamView(data = postExamSnapshot) {
  const root = document.querySelector('[data-post-exam-v27]');
  if (!root || root.dataset.boundV27 === '1') return;
  root.dataset.boundV27 = '1';

  root.querySelectorAll('[data-v27-note]').forEach((textarea) => {
    textarea.addEventListener('input', () => {
      const count = root.querySelector(`[data-v27-count="${textarea.dataset.v27Note}"]`);
      if (count) count.textContent = `${textarea.value.length}/2.000`;
    });
  });

  root.querySelector('[data-v27-save-notes]')?.addEventListener('click', (event) => {
    const notes = v27ReadNotes();
    root.querySelectorAll('[data-v27-note]').forEach((textarea) => { notes[textarea.dataset.v27Note] = textarea.value.trim(); });
    const ok = v27WriteNotes(notes);
    const state = root.querySelector('#v27NoteState');
    if (state) state.textContent = ok ? 'Anotações salvas neste navegador.' : 'Não foi possível salvar neste navegador.';
    event.currentTarget.textContent = ok ? 'Salvo ✓' : 'Tentar novamente';
    window.setTimeout(() => { event.currentTarget.textContent = 'Salvar anotações'; }, 1600);
    v27UpgradeHome(data);
  });

  root.querySelector('[data-v27-copy-summary]')?.addEventListener('click', async (event) => {
    const text = 'SEDES/DF · 06/09/2026\nEDAS · Administrador · manhã: prova realizada.\nTDAS · Técnico Administrativo · tarde: prova realizada.\nPróxima etapa: gabarito, correção, recursos e resultado.\nNota e classificação: aguardar dados oficiais.';
    try {
      await navigator.clipboard.writeText(text);
      const prior = event.currentTarget.innerHTML;
      event.currentTarget.textContent = 'Resumo copiado ✓';
      window.setTimeout(() => { event.currentTarget.innerHTML = prior; }, 1600);
    } catch {
      event.currentTarget.textContent = 'Não foi possível copiar';
    }
  });

  root.querySelector('[data-v27-print]')?.addEventListener('click', () => window.print());
}

function v27UpgradeExamView(data = postExamSnapshot) {
  if (location.hash !== '#exam-day') return;
  const content = document.getElementById('content');
  if (!content) return;
  if (content.querySelector('[data-post-exam-v27]')) {
    v27BindPostExamView(data);
    return;
  }
  const oldShell = content.querySelector('.exam21-shell[data-exam21-view]');
  if (!oldShell) return;
  content.setAttribute('aria-busy', 'true');
  content.innerHTML = v27PostExamTemplate(data);
  content.setAttribute('aria-busy', 'false');
  document.title = 'Pós-prova · Plano de Transição';
  document.body.classList.add('post-exam-v27');
  v27BindPostExamView(data);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function v27Apply(data = postExamSnapshot) {
  if (!v27IsPostExam(data)) return;
  document.documentElement.dataset.planPhase = 'post-exam';
  document.body?.classList.add('post-exam-v27');
  v27UpgradeNavigation();
  v27UpgradeMission(data);
  v27UpgradeHome(data);
  v27UpgradeExamView(data);
}

function v27Schedule(data = postExamSnapshot) {
  if (data) postExamSnapshot = data;
  if (postExamQueued) return;
  postExamQueued = true;
  requestAnimationFrame(() => {
    postExamQueued = false;
    v27Apply(postExamSnapshot);
  });
}

async function v27LoadSnapshot() {
  if (postExamSnapshot && v27IsPostExam(postExamSnapshot)) return postExamSnapshot;
  try {
    const response = await fetch(`data/snapshot.json?postExamV27=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    postExamSnapshot = await response.json();
  } catch {}
  return postExamSnapshot;
}

window.addEventListener('plano:snapshot-loaded', (event) => v27Schedule(event.detail || postExamSnapshot));
window.addEventListener('hashchange', () => window.setTimeout(() => v27Schedule(), 0));
window.addEventListener('popstate', () => window.setTimeout(() => v27Schedule(), 0));

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-refresh]')) window.setTimeout(async () => v27Schedule(await v27LoadSnapshot()), 650);
  if (event.target.closest('[data-exam-day-tab]')) window.setTimeout(() => v27Schedule(), 0);
});

const v27Observer = new MutationObserver(() => v27Schedule());

async function v27Start() {
  await v27LoadSnapshot();
  if (document.body) v27Observer.observe(document.body, { childList: true, subtree: true });
  v27Apply(postExamSnapshot);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', v27Start, { once: true });
else v27Start();
