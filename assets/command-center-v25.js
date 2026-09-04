const TZ = 'America/Sao_Paulo';
const EXAM_DAY = new Date('2026-09-06T00:00:00-03:00');
const CYCLE_START = new Date('2026-05-18T00:00:00-03:00');
const MILESTONES = [
  { at: new Date('2026-09-06T06:45:00-03:00'), label: 'EDAS · abertura dos portões', time: '06:45' },
  { at: new Date('2026-09-06T07:45:00-03:00'), label: 'EDAS · fechamento dos portões', time: '07:45' },
  { at: new Date('2026-09-06T13:45:00-03:00'), label: 'TDAS · abertura dos portões', time: '13:45' },
  { at: new Date('2026-09-06T14:45:00-03:00'), label: 'TDAS · fechamento dos portões', time: '14:45' },
];

const ICONS = {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 4 2 6 5 9-3 3-5 5-5 9m10-18c0 4-2 6-5 9 3 3 5 5 5 9"/>',
  flag: '<path d="M5 21V4m0 1h11l-2 4 2 4H5"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a4 4 0 0 0 4-4v-4a4 4 0 0 1 4-4"/>',
  chart: '<path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.check}</svg>`;
}

function pad(value) {
  return String(Math.max(0, value)).padStart(2, '0');
}

function brTime(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

function brDate(date = new Date()) {
  const value = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function countdown(now = new Date()) {
  const diff = Math.max(0, EXAM_DAY.getTime() - now.getTime());
  return {
    ended: diff === 0,
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

function cycleProgress(now = new Date()) {
  const total = EXAM_DAY.getTime() - CYCLE_START.getTime();
  const consumed = now.getTime() - CYCLE_START.getTime();
  return Math.max(0, Math.min(100, (consumed / total) * 100));
}

function phase(now = new Date()) {
  const eve = new Date('2026-09-05T00:00:00-03:00');
  const finalGate = new Date('2026-09-06T14:45:00-03:00');
  if (now < eve) return {
    label: 'Polimento final',
    directive: 'Lei seca, recorrências e nada de abrir frentes novas.',
    tone: 'polish',
  };
  if (now < EXAM_DAY) return {
    label: 'Véspera',
    directive: 'Fechar revisão, separar documentos e priorizar descanso e logística.',
    tone: 'eve',
  };
  if (now <= finalGate) return {
    label: 'Dia da prova',
    directive: 'Executar o plano: documento, canetas, deslocamento e atenção aos portões.',
    tone: 'exam',
  };
  return {
    label: 'Pós-prova',
    directive: 'Registrar resultado, preservar evidências e iniciar o fechamento do ciclo.',
    tone: 'after',
  };
}

function nextMilestone(now = new Date()) {
  const next = MILESTONES.find(item => item.at > now);
  if (next) return next;
  return { label: 'Ciclo de prova concluído', time: '06/09' };
}

function template() {
  return `
    <section class="cc25" id="commandCenterV25" aria-labelledby="cc25Title">
      <header class="cc25-head">
        <div>
          <span class="cc25-kicker"><i></i> CENTRO DE COMANDO · TEMPO REAL</span>
          <h2 id="cc25Title">Domingo sob controle.</h2>
          <p>Relógio, fase, contagem e próximos marcos reunidos em uma leitura operacional.</p>
        </div>
        <button class="cc25-exam-link" type="button" data-exam-day-tab>
          <span>${icon('route')}</span><b>Dia da Prova</b>${icon('arrow')}
        </button>
      </header>

      <div class="cc25-summary" aria-label="Resumo do domingo">
        <div><strong>2</strong><span>turnos</span><small>EDAS + TDAS</small></div>
        <div><strong>4h</strong><span>por prova</span><small>duração oficial</small></div>
        <div><strong>06/09</strong><span>domingo</span><small>Brasília/DF</small></div>
      </div>

      <div class="cc25-stage">
        <div class="cc25-stage-grid">
          <div class="cc25-clock-block">
            <span class="cc25-live"><i></i>SISTEMA EM TEMPO REAL</span>
            <b class="cc25-zone">UTC−03 · BRASÍLIA</b>
            <time id="cc25Clock" class="cc25-clock">--:--:--</time>
            <span id="cc25Date" class="cc25-date">Carregando horário de Brasília…</span>
          </div>
          <div class="cc25-orbit" aria-hidden="true">
            <span class="cc25-orbit-ring r1"></span><span class="cc25-orbit-ring r2"></span><span class="cc25-orbit-ring r3"></span>
            <span class="cc25-orbit-core">BR</span><i></i>
          </div>
        </div>

        <div class="cc25-phase" id="cc25Phase">
          <span class="cc25-phase-icon">${icon('layers')}</span>
          <div><small>FASE AUTOMÁTICA</small><strong id="cc25PhaseLabel">—</strong></div>
          <span class="cc25-phase-status">ATIVA</span>
        </div>

        <section class="cc25-countdown" aria-labelledby="cc25CountdownTitle">
          <header>
            <div><span>${icon('hourglass')}</span><div><small>CONTAGEM PARA 06/09</small><strong id="cc25CountdownTitle">Tempo restante</strong></div></div>
            <span class="cc25-dtag">até 00:00 · sem inferir início da prova</span>
          </header>
          <div class="cc25-units">
            <div><strong id="cc25Days">00</strong><span>DIAS</span></div>
            <div><strong id="cc25Hours">00</strong><span>HORAS</span></div>
            <div><strong id="cc25Minutes">00</strong><span>MIN</span></div>
            <div><strong id="cc25Seconds">00</strong><span>SEG</span></div>
          </div>
        </section>

        <div class="cc25-directive">
          <span>${icon('check')}</span>
          <div><small>DIRETRIZ DA FASE</small><p id="cc25Directive">—</p></div>
        </div>

        <div class="cc25-progress-block">
          <div><span>Tempo consumido do ciclo final · 18/05 → 06/09</span><strong id="cc25ProgressLabel">0,0%</strong></div>
          <div class="cc25-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="cc25ProgressBar"></i></div>
        </div>

        <button class="cc25-milestone" type="button" data-exam-day-tab>
          <span class="cc25-milestone-icon">${icon('flag')}</span>
          <span><small>PRÓXIMO MARCO OFICIAL</small><strong id="cc25Milestone">—</strong><em id="cc25MilestoneTime">—</em></span>
          ${icon('arrow')}
        </button>
      </div>

      <nav class="cc25-actions" aria-label="Atalhos do centro de comando">
        <button type="button" data-exam-day-tab><span>${icon('calendar')}</span><b>Dia da Prova</b><small>portões, salas e checklist</small></button>
        <button type="button" data-view="performance"><span>${icon('chart')}</span><b>Desempenho</b><small>leitura por matéria</small></button>
        <button type="button" data-view="journey"><span>${icon('route')}</span><b>Jornada</b><small>marcos e evolução</small></button>
      </nav>
    </section>`;
}

let timer = null;

function update() {
  const root = document.getElementById('commandCenterV25');
  if (!root) return;
  const now = new Date();
  const parts = countdown(now);
  const currentPhase = phase(now);
  const milestone = nextMilestone(now);
  const progress = cycleProgress(now);

  const set = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  set('cc25Clock', brTime(now));
  set('cc25Date', brDate(now));
  set('cc25Days', pad(parts.days));
  set('cc25Hours', pad(parts.hours));
  set('cc25Minutes', pad(parts.minutes));
  set('cc25Seconds', pad(parts.seconds));
  set('cc25PhaseLabel', currentPhase.label);
  set('cc25Directive', currentPhase.directive);
  set('cc25Milestone', milestone.label);
  set('cc25MilestoneTime', milestone.time);
  set('cc25ProgressLabel', `${progress.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

  const phaseNode = document.getElementById('cc25Phase');
  if (phaseNode) phaseNode.dataset.phase = currentPhase.tone;
  const bar = document.getElementById('cc25ProgressBar');
  if (bar) bar.style.width = `${progress}%`;
  const progressNode = root.querySelector('.cc25-progress');
  progressNode?.setAttribute('aria-valuenow', progress.toFixed(1));
}

function mount() {
  const view = document.querySelector('.command-view');
  if (!view || document.getElementById('commandCenterV25')) return;
  const heading = view.querySelector('.view-heading');
  if (heading) heading.insertAdjacentHTML('afterend', template());
  else view.insertAdjacentHTML('afterbegin', template());
  document.body.dataset.commandCenterVersion = '25';
  update();
  if (!timer) timer = window.setInterval(update, 1000);
}

let queued = false;
const observer = new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    mount();
  });
});

mount();
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', mount);
