const EXAM_OPS_V25 = {
  timezone: 'America/Sao_Paulo',
  officialUrl: 'https://quadrix.org.br/informacoes/3056/',
  milestones: [
    { id: 'edas-open', at: '2026-09-06T06:45:00-03:00', label: 'EDAS · abertura dos portões', time: '06:45', tone: 'open' },
    { id: 'edas-close', at: '2026-09-06T07:45:00-03:00', label: 'EDAS · fechamento dos portões', time: '07:45', tone: 'critical' },
    { id: 'tdas-open', at: '2026-09-06T13:45:00-03:00', label: 'TDAS · abertura dos portões', time: '13:45', tone: 'open' },
    { id: 'tdas-close', at: '2026-09-06T14:45:00-03:00', label: 'TDAS · fechamento dos portões', time: '14:45', tone: 'critical' }
  ]
};

const firstGate = new Date(EXAM_OPS_V25.milestones[0].at).getTime();
const lastGate = new Date(EXAM_OPS_V25.milestones.at(-1).at).getTime();
let v25Timer = null;
let v25Observer = null;

function v25NextMilestone(now = Date.now()) {
  return EXAM_OPS_V25.milestones.find(item => new Date(item.at).getTime() > now) || null;
}

function v25Phase(now = Date.now()) {
  const edasOpen = new Date(EXAM_OPS_V25.milestones[0].at).getTime();
  const edasClose = new Date(EXAM_OPS_V25.milestones[1].at).getTime();
  const tdasOpen = new Date(EXAM_OPS_V25.milestones[2].at).getTime();
  const tdasClose = new Date(EXAM_OPS_V25.milestones[3].at).getTime();

  if (now < edasOpen) return {
    key: 'polimento', label: 'Polimento final',
    directive: 'Lei seca, recorrências e nada de abrir frentes novas.'
  };
  if (now < edasClose) return {
    key: 'edas', label: 'Janela de entrada · EDAS',
    directive: 'Documento e canetas em mãos; entre, localize a sala e siga as orientações da equipe.'
  };
  if (now < tdasOpen) return {
    key: 'intervalo', label: 'Intervalo entre turnos',
    directive: 'Saída, alimentação, hidratação e retorno com margem para a abertura dos portões às 13:45.'
  };
  if (now < tdasClose) return {
    key: 'tdas', label: 'Janela de entrada · TDAS',
    directive: 'Prioridade absoluta: entrar antes de 14:45, localizar a sala e seguir as orientações da equipe.'
  };
  return {
    key: 'encerrado', label: 'Portões encerrados',
    directive: 'Siga somente as orientações da equipe de aplicação. O plano volta ao registro e pós-prova depois dos turnos.'
  };
}

function v25Parts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60
  };
}

function v25Compact(ms) {
  const parts = v25Parts(ms);
  if (ms <= 0) return 'agora';
  if (parts.days) return `${parts.days}d ${String(parts.hours).padStart(2, '0')}h ${String(parts.minutes).padStart(2, '0')}min`;
  return `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}:${String(parts.seconds).padStart(2, '0')}`;
}

function v25Progress(now = Date.now()) {
  if (now <= firstGate) return 0;
  if (now >= lastGate) return 100;
  return Math.max(0, Math.min(100, ((now - firstGate) / (lastGate - firstGate)) * 100));
}

function v25Brasilia(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: EXAM_OPS_V25.timezone,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(date);
}

function v25Icon(path) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
}

const V25_ICONS = {
  clock: v25Icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  arrow: v25Icon('<path d="M5 12h14m-5-5 5 5-5 5"/>'),
  flag: v25Icon('<path d="M5 21V4m0 1h11l-2 4 2 4H5"/>'),
  pulse: v25Icon('<path d="M3 12h4l2-5 4 10 2-5h6"/>')
};

function v25HomeTemplate() {
  return `<div class="v25-home-ops" data-v25-home-ops>
    <div class="v25-home-ops__phase">
      <span>FASE AUTOMÁTICA</span>
      <strong data-v25-home-phase>—</strong>
    </div>
    <div class="v25-home-ops__next">
      <span>PRÓXIMO MARCO OFICIAL</span>
      <strong data-v25-home-next>—</strong>
      <small data-v25-home-countdown>—</small>
    </div>
    <button type="button" data-v25-open-exam>${V25_ICONS.arrow}<span>Dia da Prova</span></button>
  </div>`;
}

function v25ExamTemplate() {
  return `<section class="v25-ops-center" id="exam25Ops" aria-labelledby="exam25Title">
    <header class="v25-ops-head">
      <div>
        <span>${V25_ICONS.pulse} MODO OPERACIONAL</span>
        <h3 id="exam25Title">Domingo em tempo real</h3>
        <p>Fase, contagem e marcos mudam automaticamente conforme as janelas oficiais de portão.</p>
      </div>
      <div class="v25-ops-now"><span>BRASÍLIA</span><strong data-v25-brasilia>--:--:--</strong></div>
    </header>

    <div class="v25-ops-phase" data-v25-phase-tone="polimento">
      <div><span>FASE AUTOMÁTICA</span><strong data-v25-phase>—</strong></div>
      <div><span>DIRETRIZ DO PLANO</span><p data-v25-directive>—</p></div>
      <small>Automação do Plano de Transição; não substitui instrução oficial da equipe de aplicação.</small>
    </div>

    <div class="v25-ops-countdown">
      <div class="v25-ops-countdown__head">
        <div><span>CONTAGEM PARA O PRÓXIMO MARCO</span><strong data-v25-next-label>—</strong></div>
        <b data-v25-next-time>—</b>
      </div>
      <div class="v25-ops-units" aria-label="Contagem regressiva para o próximo marco oficial">
        <div><strong data-v25-days>00</strong><span>DIAS</span></div>
        <div><strong data-v25-hours>00</strong><span>HORAS</span></div>
        <div><strong data-v25-minutes>00</strong><span>MIN</span></div>
        <div><strong data-v25-seconds>00</strong><span>SEG</span></div>
      </div>
    </div>

    <div class="v25-ops-progress">
      <div><span>PROGRESSO DA JANELA DE PORTÕES</span><strong data-v25-progress-label>0,0%</strong></div>
      <div class="v25-ops-track" role="progressbar" aria-label="Progresso entre a primeira abertura e o último fechamento de portões" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i data-v25-progress-bar></i></div>
      <small>06:45 EDAS → 14:45 TDAS. Isto acompanha os portões, não a duração das provas.</small>
    </div>

    <div class="v25-ops-milestone">
      <div class="v25-ops-milestone__icon">${V25_ICONS.flag}</div>
      <div><span>PRÓXIMO MARCO OFICIAL</span><strong data-v25-milestone>—</strong><small data-v25-milestone-countdown>—</small></div>
      <a href="${EXAM_OPS_V25.officialUrl}" target="_blank" rel="noreferrer">Quadrix ${V25_ICONS.arrow}</a>
    </div>
  </section>`;
}

function v25EnsureHome() {
  const card = document.querySelector('.command-view .countdown-card');
  if (!card || card.querySelector('[data-v25-home-ops]')) return;
  card.insertAdjacentHTML('beforeend', v25HomeTemplate());
}

function v25EnsureExam() {
  const shell = document.querySelector('.exam21-shell');
  if (!shell || shell.querySelector('#exam25Ops')) return;
  const hero = shell.querySelector('.exam21-hero');
  if (!hero) return;
  hero.insertAdjacentHTML('afterend', v25ExamTemplate());
}

function v25Set(selector, value) {
  document.querySelectorAll(selector).forEach(node => { node.textContent = value; });
}

function v25Update(now = Date.now()) {
  const phase = v25Phase(now);
  const next = v25NextMilestone(now);
  const remaining = next ? new Date(next.at).getTime() - now : 0;
  const parts = v25Parts(remaining);
  const progress = v25Progress(now);

  v25Set('[data-v25-home-phase]', phase.label);
  v25Set('[data-v25-phase]', phase.label);
  v25Set('[data-v25-directive]', phase.directive);
  v25Set('[data-v25-brasilia]', v25Brasilia(new Date(now)));

  const nextLabel = next ? next.label : 'Cronograma de portões encerrado';
  const nextTime = next ? next.time : '—';
  const compact = next ? `faltam ${v25Compact(remaining)}` : 'sem novos marcos de portão';

  v25Set('[data-v25-home-next]', next ? `${next.label} · ${next.time}` : nextLabel);
  v25Set('[data-v25-home-countdown]', compact);
  v25Set('[data-v25-next-label]', nextLabel);
  v25Set('[data-v25-next-time]', nextTime);
  v25Set('[data-v25-milestone]', next ? `${next.label} · ${next.time}` : nextLabel);
  v25Set('[data-v25-milestone-countdown]', compact);
  v25Set('[data-v25-days]', String(parts.days).padStart(2, '0'));
  v25Set('[data-v25-hours]', String(parts.hours).padStart(2, '0'));
  v25Set('[data-v25-minutes]', String(parts.minutes).padStart(2, '0'));
  v25Set('[data-v25-seconds]', String(parts.seconds).padStart(2, '0'));
  v25Set('[data-v25-progress-label]', `${progress.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

  document.querySelectorAll('[data-v25-progress-bar]').forEach(node => { node.style.width = `${progress}%`; });
  document.querySelectorAll('.v25-ops-track').forEach(node => node.setAttribute('aria-valuenow', progress.toFixed(1)));
  document.querySelectorAll('.v25-ops-phase').forEach(node => node.setAttribute('data-v25-phase-tone', phase.key));
}

function v25Sync() {
  v25EnsureHome();
  v25EnsureExam();
  v25Update();
}

function v25OpenExam() {
  const tab = document.querySelector('#mainTabs [data-exam-day-tab]') || document.querySelector('#mobileDock [data-exam-day-tab]');
  if (tab) tab.click();
  else location.hash = '#exam-day';
}

function initExamOpsV25() {
  document.body.dataset.examOpsVersion = '25';
  v25Sync();
  const content = document.getElementById('content');
  if (content) {
    v25Observer = new MutationObserver(() => queueMicrotask(v25Sync));
    v25Observer.observe(content, { childList: true, subtree: true });
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-v25-open-exam]')) v25OpenExam();
  });
  window.addEventListener('hashchange', () => window.setTimeout(v25Sync, 0));
  v25Timer = window.setInterval(() => v25Update(), 1000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initExamOpsV25, { once: true });
else initExamOpsV25();
