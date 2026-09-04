const EXAM_DAY_V21 = {
  date: '06/09/2026',
  timezone: 'America/Sao_Paulo',
  venue: 'Centro de Ensino Fundamental Telebrasília — Riacho Fundo I',
  address: 'QN 1, Área Especial 1, Lote 01/02, Praça Central, Riacho Fundo I — Brasília/DF',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Centro%20de%20Ensino%20Fundamental%20Telebras%C3%ADlia%20Riacho%20Fundo%20I%20Bras%C3%ADlia%20DF',
  officialUrl: 'https://quadrix.org.br/informacoes/3056/',
  edital4Url: 'https://anexos-r2.selecao.net.br/uploads/861/concursos/3056/anexos/1b71515c-013f-4d4b-8fd2-d52866e86683.pdf',
  exams: [
    {
      id: 'edas', code: 'EDAS · CARGO 400', title: 'Administração', turn: 'Manhã', room: '1820', block: '1', floor: 'T',
      open: '06:45', close: '07:45', openIso: '2026-09-06T06:45:00-03:00', closeIso: '2026-09-06T07:45:00-03:00'
    },
    {
      id: 'tdas', code: 'TDAS · CARGO 202', title: 'Técnico Administrativo', turn: 'Tarde', room: '1830', block: '1', floor: '1',
      open: '13:45', close: '14:45', openIso: '2026-09-06T13:45:00-03:00', closeIso: '2026-09-06T14:45:00-03:00'
    }
  ]
};

const CHECK_KEY = 'plano-transicao:exam-day-v19:checks';
const INITIAL_EXAM_DAY = location.hash === '#exam-day';
let examDayTimer = null;
let contentObserver = null;

const ICONS = {
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-5"/>',
  alert: '<path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
  bag: '<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  file: '<path d="M6 2h8l4 4v16H6V2Z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
  external: '<path d="M14 3h7v7m0-7-9 9"/><path d="M18 13v7H4V6h7"/>',
  copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>'
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.calendar}</svg>`;
}

function parseChecks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHECK_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveChecks(state) {
  try { localStorage.setItem(CHECK_KEY, JSON.stringify(state)); } catch {}
}

function formatRemaining(ms) {
  if (ms <= 0) return 'agora';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min`;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function brasiliaTime(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: EXAM_DAY_V21.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
}

function nextMilestone(now = Date.now()) {
  const items = EXAM_DAY_V21.exams.flatMap(exam => [
    { at: new Date(exam.openIso).getTime(), label: `Abertura dos portões · ${exam.id.toUpperCase()}`, tone: 'open' },
    { at: new Date(exam.closeIso).getTime(), label: `Fechamento dos portões · ${exam.id.toUpperCase()}`, tone: 'critical' }
  ]).sort((a, b) => a.at - b.at);
  return items.find(item => item.at > now) || { at: null, label: 'Cronograma de entrada encerrado', tone: 'done' };
}

function gateStatus(exam, now = Date.now()) {
  const opens = new Date(exam.openIso).getTime();
  const closes = new Date(exam.closeIso).getTime();
  if (now < opens) return { label: `Abre às ${exam.open}`, state: 'waiting' };
  if (now < closes) return { label: `ENTRADA LIBERADA · fecha ${exam.close}`, state: 'open' };
  return { label: `Portões fechados · ${exam.close}`, state: 'closed' };
}

function examCard(exam) {
  const status = gateStatus(exam);
  return `<article class="exam21-turn exam21-turn--${exam.id}">
    <div class="exam21-turn__head">
      <div><span class="exam21-chip">${exam.code}</span><h3>${exam.title}</h3><p>${exam.turn} · domingo</p></div>
      <span class="exam21-status exam21-status--${status.state}" data-exam21-status="${exam.id}">${status.label}</span>
    </div>
    <div class="exam21-gates" aria-label="Portões ${exam.code}">
      <div><small>ABERTURA</small><strong>${exam.open}</strong></div>
      <span>${icon('arrow')}</span>
      <div><small>FECHAMENTO</small><strong>${exam.close}</strong><em>sem tolerância</em></div>
    </div>
    <div class="exam21-application">
      <div class="exam21-application__title">${icon('clock')}<span><small>HORÁRIO DA APLICAÇÃO</small><strong>Não confundir portão com início da prova</strong></span></div>
      <div class="exam21-application__grid">
        <div><span>Início</span><b>Não divulgado oficialmente</b></div>
        <div><span>Duração</span><b>4 horas</b></div>
        <div><span>Término</span><b>4h após o início efetivo</b></div>
      </div>
      <p>Os documentos oficiais publicam o turno, a janela de entrada e a duração, mas não fixam uma hora nominal de início.</p>
    </div>
    <div class="exam21-room-grid">
      <div><span>Sala</span><strong>${exam.room}</strong></div>
      <div><span>Bloco</span><strong>${exam.block}</strong></div>
      <div><span>Andar</span><strong>${exam.floor}</strong></div>
    </div>
    <div class="exam21-arrival"><b>Meta conservadora:</b> estar no local na abertura dos portões (${exam.open}), coerente com a recomendação do CCI de chegar com pelo menos 1h de antecedência.</div>
  </article>`;
}

function timeline() {
  return `<div class="exam21-timeline" aria-label="Linha do tempo de domingo">
    <div class="exam21-timepoint"><span>06:45</span><b>EDAS abre</b><small>entrada liberada</small></div>
    <i></i>
    <div class="exam21-timepoint critical"><span>07:45</span><b>EDAS fecha</b><small>sem tolerância</small></div>
    <i class="break"></i>
    <div class="exam21-timepoint break"><span>ENTRE TURNOS</span><b>Saída + almoço + retorno</b><small>mesmo endereço</small></div>
    <i class="break"></i>
    <div class="exam21-timepoint"><span>13:45</span><b>TDAS abre</b><small>entrada liberada</small></div>
    <i></i>
    <div class="exam21-timepoint critical"><span>14:45</span><b>TDAS fecha</b><small>sem tolerância</small></div>
  </div>`;
}

function checklist() {
  const saved = parseChecks();
  const items = [
    ['documento', 'Documento original de identidade válido'],
    ['canetas', '2 ou 3 canetas transparentes azul ou preta'],
    ['comprovante', 'Comprovante de inscrição ou pagamento'],
    ['agua', 'Água em recipiente transparente'],
    ['lanche', 'Lanche em embalagem transparente'],
    ['rota', 'Rota e endereço conferidos'],
    ['celular', 'Alarmes desativados; celular pronto para desligar'],
    ['saida', 'Horários dos dois portões memorizados']
  ];
  return `<section class="exam21-checklist-card" id="exam21Checklist">
    <div class="exam21-section-head"><div><span>CHECKLIST</span><h3>Antes de sair de casa</h3><p>Fica salvo neste aparelho.</p></div><strong id="exam21Progress">0/${items.length}</strong></div>
    <div class="exam21-check-grid" id="exam21Checks">${items.map(([id, label]) => `<label class="exam21-check ${saved[id] ? 'done' : ''}"><input type="checkbox" value="${id}" ${saved[id] ? 'checked' : ''}><span class="exam21-checkmark">${icon('check')}</span><span>${label}</span></label>`).join('')}</div>
    <div class="exam21-check-actions"><button type="button" data-exam21-all>Marcar tudo</button><button type="button" data-exam21-clear>Limpar</button></div>
  </section>`;
}

function rules() {
  return `<section class="exam21-rules" id="exam21Rules">
    <article><div class="exam21-rule-icon ok">${icon('bag')}</div><span>LEVAR</span><h3>Essenciais</h3><ul><li>Documento original válido; documento digital apenas no aplicativo oficial.</li><li>Caneta azul ou preta de material transparente; leve pelo menos duas.</li><li>Comprovante de inscrição provisória ou pagamento, caso seja solicitado.</li><li>Água e alimentos somente em recipiente/embalagem transparente.</li></ul></article>
    <article><div class="exam21-rule-icon no">${icon('alert')}</div><span>NÃO LEVAR / NÃO USAR</span><h3>Evite risco de eliminação</h3><ul><li>Relógio de qualquer espécie, smartwatch, fones ou calculadora.</li><li>Chaves com alarme ou componente eletrônico.</li><li>Lápis, lapiseira, borracha, marca-texto, livros, anotações ou impressos.</li><li>Óculos escuros, protetor auricular, chapelaria e recipientes opacos.</li></ul></article>
    <article><div class="exam21-rule-icon critical">${icon('shield')}</div><span>REGRAS CRÍTICAS</span><h3>O que não pode dar errado</h3><ul><li>Celular e eletrônicos completamente desligados e lacrados no porta-objetos.</li><li>Print, foto ou PDF de documento digital não são aceitos.</li><li>Após entrar, vá diretamente para sua sala.</li><li>Permanência mínima: 2h após o início. Caderno somente nos últimos 60 minutos.</li></ul></article>
  </section>`;
}

function viewTemplate() {
  const next = nextMilestone();
  return `<div class="exam21-shell" data-exam21-view>
    <section class="exam21-hero">
      <div class="exam21-hero__copy">
        <div class="exam21-badges"><span>${icon('calendar')} DOMINGO · 06 SET</span><span class="verified">${icon('shield')} AUDITADO</span></div>
        <h2>Dia da prova, <em>sem ruído.</em></h2>
        <p>Uma central só para domingo: portões, salas, local, checklist e regras. O que não foi publicado oficialmente aparece como não divulgado — sem completar lacunas por suposição.</p>
        <div class="exam21-hero__actions"><a href="${EXAM_DAY_V21.mapsUrl}" target="_blank" rel="noreferrer">${icon('route')} Abrir rota</a><a href="${EXAM_DAY_V21.officialUrl}" target="_blank" rel="noreferrer" class="secondary">${icon('external')} Quadrix</a><button type="button" data-exam21-copy-summary>${icon('copy')} Copiar resumo</button></div>
      </div>
      <div class="exam21-live-card">
        <div><span>BRASÍLIA AGORA</span><strong id="exam21Clock">${brasiliaTime()}</strong><small>horário oficial de referência</small></div>
        <div class="exam21-next ${next.tone}"><span>PRÓXIMO MARCO</span><strong id="exam21NextLabel">${next.label}</strong><b id="exam21NextClock">${next.at ? formatRemaining(next.at - Date.now()) : 'encerrado'}</b></div>
      </div>
    </section>

    <nav class="exam21-subnav" aria-label="Seções do dia da prova"><button type="button" data-exam21-scroll="exam21Summary">Resumo</button><button type="button" data-exam21-scroll="exam21Turns">Turnos</button><button type="button" data-exam21-scroll="exam21Checklist">Checklist</button><button type="button" data-exam21-scroll="exam21Rules">Regras</button><button type="button" data-exam21-scroll="exam21Sources">Fontes</button></nav>

    <section class="exam21-summary" id="exam21Summary">
      <article class="exam21-location-card">
        <div class="exam21-location-icon">${icon('map')}</div>
        <div><span>MESMO LOCAL NOS DOIS TURNOS</span><h3>${EXAM_DAY_V21.venue}</h3><p>${EXAM_DAY_V21.address}</p><div><a href="${EXAM_DAY_V21.mapsUrl}" target="_blank" rel="noreferrer">Abrir rota</a><button type="button" data-exam21-copy-address>Copiar endereço</button></div></div>
      </article>
      <article class="exam21-day-card"><span>VISÃO DO DOMINGO</span><h3>Uma prova por vez.</h3>${timeline()}</article>
    </section>

    <section class="exam21-turns" id="exam21Turns">${EXAM_DAY_V21.exams.map(examCard).join('')}</section>

    <section class="exam21-between">
      <div class="exam21-between__icon">${icon('route')}</div>
      <div><span>ENTRE OS TURNOS</span><h3>Não carregue a prova da manhã para a tarde.</h3><p>Saia conforme a orientação da equipe, almoce, hidrate-se, descanse e retorne ao mesmo endereço. A TDAS é em outra sala e outro andar. O intervalo disponível depende do início efetivo da aplicação e do momento em que você sair — por isso o site não inventa uma duração fixa.</p></div>
      <div class="exam21-between__facts"><span><b>TDAS abre</b>13:45</span><span><b>Sala</b>1830</span><span><b>Andar</b>1</span></div>
    </section>

    ${checklist()}
    ${rules()}

    <section class="exam21-sources" id="exam21Sources">
      <div class="exam21-source-main"><div class="exam21-source-icon">${icon('shield')}</div><div><span>FONTE E CONFIANÇA</span><h3>O horário exato de início não foi publicado.</h3><p>Conferido no Edital nº 1 atualizado, cronograma, Edital nº 4 de convocação e nos dois CCIs. Todos informam turno, janela dos portões e duração de 4 horas; nenhum fixa 08:00/12:00 ou 15:00/19:00 como horários nominais de aplicação.</p></div></div>
      <div class="exam21-source-links"><a href="${EXAM_DAY_V21.edital4Url}" target="_blank" rel="noreferrer">${icon('file')} Edital nº 4</a><a href="${EXAM_DAY_V21.officialUrl}" target="_blank" rel="noreferrer">${icon('external')} Página oficial</a></div>
      <p class="exam21-source-note"><strong>Regra do painel:</strong> fechamento do portão não é rotulado como início da prova. O término é apresentado apenas como “4h após o início efetivo”.</p>
    </section>
  </div>`;
}

function addNavigation() {
  const mainTabs = document.getElementById('mainTabs');
  if (mainTabs && !mainTabs.querySelector('[data-exam-day-tab]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.examDayTab = '';
    button.innerHTML = `${icon('calendar')}<b>Dia da Prova</b>`;
    mainTabs.insertBefore(button, mainTabs.children[1] || null);
  }

  const dock = document.getElementById('mobileDock');
  if (dock && !dock.querySelector('[data-exam-day-tab]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.examDayTab = '';
    button.innerHTML = `${icon('calendar')}<small>Dia da Prova</small>`;
    dock.insertBefore(button, dock.children[1] || null);
  }

  const sheet = document.querySelector('#moreSheet .sheet-grid');
  if (sheet && !sheet.querySelector('[data-exam-day-tab]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.examDayTab = '';
    button.innerHTML = `${icon('calendar')}<span><b>Dia da Prova</b><small>domingo, local e checklist</small></span>`;
    sheet.insertBefore(button, sheet.children[1] || null);
  }
}

function syncTabState(active) {
  document.querySelectorAll('[data-view]').forEach(node => node.classList.toggle('active', !active && node.dataset.view === location.hash.slice(1)));
  document.querySelectorAll('[data-exam-day-tab]').forEach(node => {
    node.classList.toggle('active', active);
    node.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function updateProgress() {
  const inputs = [...document.querySelectorAll('#exam21Checks input[type="checkbox"]')];
  const done = inputs.filter(input => input.checked).length;
  const node = document.getElementById('exam21Progress');
  if (node) node.textContent = `${done}/${inputs.length}`;
}

function bindView() {
  document.querySelectorAll('[data-exam21-scroll]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.exam21Scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' })));

  const checks = document.getElementById('exam21Checks');
  checks?.addEventListener('change', event => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    const state = parseChecks();
    state[input.value] = input.checked;
    saveChecks(state);
    input.closest('.exam21-check')?.classList.toggle('done', input.checked);
    updateProgress();
  });

  document.querySelector('[data-exam21-all]')?.addEventListener('click', () => {
    const state = {};
    checks?.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true; state[input.value] = true; input.closest('.exam21-check')?.classList.add('done'); });
    saveChecks(state); updateProgress();
  });

  document.querySelector('[data-exam21-clear]')?.addEventListener('click', () => {
    checks?.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; input.closest('.exam21-check')?.classList.remove('done'); });
    saveChecks({}); updateProgress();
  });

  document.querySelector('[data-exam21-copy-address]')?.addEventListener('click', async event => {
    try { await navigator.clipboard.writeText(`${EXAM_DAY_V21.venue} — ${EXAM_DAY_V21.address}`); event.currentTarget.textContent = 'Endereço copiado'; }
    catch { event.currentTarget.textContent = 'Copie pelo texto acima'; }
  });

  document.querySelector('[data-exam21-copy-summary]')?.addEventListener('click', async event => {
    const text = `SEDES/DF — 06/09/2026\nEDAS Administração: portões 06:45–07:45, sala 1820, bloco 1, andar T.\nTDAS Técnico Administrativo: portões 13:45–14:45, sala 1830, bloco 1, andar 1.\nLocal: ${EXAM_DAY_V21.venue} — ${EXAM_DAY_V21.address}.\nDuração: 4h em cada turno. Horário nominal de início não divulgado oficialmente.`;
    try { await navigator.clipboard.writeText(text); const prior = event.currentTarget.innerHTML; event.currentTarget.textContent = 'Resumo copiado'; setTimeout(() => { event.currentTarget.innerHTML = prior; }, 1800); }
    catch { event.currentTarget.textContent = 'Não foi possível copiar'; }
  });

  updateProgress();
}

function updateLive() {
  if (location.hash !== '#exam-day') return;
  const now = Date.now();
  const next = nextMilestone(now);
  const clock = document.getElementById('exam21Clock');
  const nextLabel = document.getElementById('exam21NextLabel');
  const nextClock = document.getElementById('exam21NextClock');
  if (clock) clock.textContent = brasiliaTime(new Date(now));
  if (nextLabel) nextLabel.textContent = next.label;
  if (nextClock) nextClock.textContent = next.at ? formatRemaining(next.at - now) : 'encerrado';
  EXAM_DAY_V21.exams.forEach(exam => {
    const node = document.querySelector(`[data-exam21-status="${exam.id}"]`);
    if (!node) return;
    const status = gateStatus(exam, now);
    node.textContent = status.label;
    node.className = `exam21-status exam21-status--${status.state}`;
  });
}

function renderExamDay({ push = true } = {}) {
  const content = document.getElementById('content');
  if (!content) return;
  if (push && location.hash !== '#exam-day') history.pushState(null, '', '#exam-day');
  content.setAttribute('aria-busy', 'true');
  content.innerHTML = viewTemplate();
  content.setAttribute('aria-busy', 'false');
  document.getElementById('examDayControl')?.remove();
  syncTabState(true);
  document.title = 'Dia da Prova · Plano de Transição';
  bindView();
  updateLive();
  clearInterval(examDayTimer);
  examDayTimer = setInterval(updateLive, 1000);
  window.scrollTo({ top: 0, behavior: push ? 'smooth' : 'auto' });
}

function leaveExamDay() {
  clearInterval(examDayTimer);
  examDayTimer = null;
  syncTabState(false);
}

function setup() {
  addNavigation();
  document.getElementById('examDayControl')?.remove();

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-exam-day-tab]');
    if (!tab) return;
    event.preventDefault();
    renderExamDay({ push: true });
  });

  window.addEventListener('hashchange', () => {
    if (location.hash === '#exam-day') renderExamDay({ push: false });
    else leaveExamDay();
  });
  window.addEventListener('popstate', () => {
    if (location.hash === '#exam-day') renderExamDay({ push: false });
    else leaveExamDay();
  });

  const content = document.getElementById('content');
  if (content) {
    contentObserver = new MutationObserver(() => {
      if (location.hash === '#exam-day' && !content.querySelector('[data-exam21-view]')) renderExamDay({ push: false });
    });
    contentObserver.observe(content, { childList: true });
  }

  if (INITIAL_EXAM_DAY || location.hash === '#exam-day') {
    history.replaceState(null, '', '#exam-day');
    renderExamDay({ push: false });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
else setup();
