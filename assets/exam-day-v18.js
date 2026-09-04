const EXAM_DAY = {
  dateLabel: 'DOMINGO · 06/09/2026',
  venue: 'Centro de Ensino Fundamental Telebrasília — Riacho Fundo I',
  address: 'QN 1, Área Especial 1, Lote 01/02, Praça Central, Riacho Fundo I — Brasília/DF',
  officialUrl: 'https://quadrix.org.br/informacoes/3056/',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Centro%20de%20Ensino%20Fundamental%20Telebras%C3%ADlia%20Riacho%20Fundo%20I%20Bras%C3%ADlia%20DF',
  timezone: 'America/Sao_Paulo',
  exams: [
    {
      id: 'edas',
      code: 'EDAS · CARGO 400',
      title: 'Administração',
      turn: 'Manhã',
      room: '1820',
      block: '1',
      floor: 'T',
      open: '06:45',
      close: '07:45',
      openIso: '2026-09-06T06:45:00-03:00',
      closeIso: '2026-09-06T07:45:00-03:00'
    },
    {
      id: 'tdas',
      code: 'TDAS · CARGO 202',
      title: 'Técnico Administrativo',
      turn: 'Tarde',
      room: '1830',
      block: '1',
      floor: '1',
      open: '13:45',
      close: '14:45',
      openIso: '2026-09-06T13:45:00-03:00',
      closeIso: '2026-09-06T14:45:00-03:00'
    }
  ]
};

const CHECK_STORAGE_KEY = 'plano-transicao:exam-day-v18:checks';
const CHECK_ITEMS = [
  ['documento', 'Documento de identidade válido separado'],
  ['canetas', '2 ou 3 canetas transparentes azul ou preta'],
  ['agua', 'Água em recipiente transparente'],
  ['lanche', 'Lanche em embalagem transparente'],
  ['comprovante', 'Comprovante de inscrição/pagamento separado'],
  ['rota', 'Rota e tempo de deslocamento conferidos'],
  ['celular', 'Alarmes desativados e celular pronto para desligar'],
  ['saida', 'Horários de abertura e fechamento memorizados']
];

function safeStorageRead() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHECK_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeStorageWrite(value) {
  try {
    localStorage.setItem(CHECK_STORAGE_KEY, JSON.stringify(value));
  } catch {}
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

function getBrasiliaClock(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: EXAM_DAY.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

function getNextMilestone(now = Date.now()) {
  const milestones = EXAM_DAY.exams
    .flatMap(exam => [
      { at: new Date(exam.openIso).getTime(), label: `Abertura dos portões · ${exam.code}` },
      { at: new Date(exam.closeIso).getTime(), label: `FECHAMENTO DOS PORTÕES · ${exam.code}` }
    ])
    .sort((a, b) => a.at - b.at);
  return milestones.find(item => item.at > now) || { at: null, label: 'Cronograma de acesso de 06/09 encerrado' };
}

function examStatus(exam, now = Date.now()) {
  const opens = new Date(exam.openIso).getTime();
  const closes = new Date(exam.closeIso).getTime();
  if (now < opens) return { text: `Portões abrem às ${exam.open}`, state: 'waiting' };
  if (now < closes) return { text: `ENTRADA LIBERADA · fecha ${exam.close}`, state: 'open' };
  return { text: `Portões fechados desde ${exam.close}`, state: 'closed' };
}

function turnCard(exam) {
  const status = examStatus(exam);
  return `
    <article class="exam-v18-turn exam-v18-turn--${exam.id}">
      <header class="exam-v18-turn__head">
        <div>
          <span class="exam-v18-chip">${exam.code}</span>
          <h3>${exam.title}</h3>
          <p>${exam.turn} · 06/09/2026</p>
        </div>
        <span class="exam-v18-status exam-v18-status--${status.state}" data-exam-status="${exam.id}">${status.text}</span>
      </header>
      <div class="exam-v18-gate" aria-label="Janela de entrada ${exam.code}">
        <div><small>Portões abrem</small><strong>${exam.open}</strong></div>
        <span aria-hidden="true">→</span>
        <div><small>Portões fecham</small><strong>${exam.close}</strong></div>
      </div>
      <dl class="exam-v18-meta">
        <div><dt>Sala</dt><dd>${exam.room}</dd></div>
        <div><dt>Bloco</dt><dd>${exam.block}</dd></div>
        <div><dt>Andar</dt><dd>${exam.floor}</dd></div>
        <div><dt>Duração</dt><dd>4 horas</dd></div>
      </dl>
      <div class="exam-v18-note"><strong>Chegada planejada:</strong> esteja no local na abertura dos portões (${exam.open}). O CCI recomenda no mínimo 1 hora de antecedência. Não há hora nominal de início publicada no CCI/Edital nº 4.</div>
    </article>`;
}

function timeline() {
  return `
    <div class="exam-v18-timeline" aria-label="Linha do tempo do dia da prova">
      <div class="exam-v18-timeline__item"><span>06:45</span><strong>EDAS · abre</strong><small>Entrada liberada</small></div>
      <div class="exam-v18-timeline__line" aria-hidden="true"></div>
      <div class="exam-v18-timeline__item exam-v18-timeline__item--critical"><span>07:45</span><strong>EDAS · fecha</strong><small>Sem tolerância</small></div>
      <div class="exam-v18-timeline__line exam-v18-timeline__line--break" aria-hidden="true"></div>
      <div class="exam-v18-timeline__item exam-v18-timeline__item--break"><span>Intervalo</span><strong>Saída + almoço + retorno</strong><small>Mesmo endereço no 2º turno</small></div>
      <div class="exam-v18-timeline__line exam-v18-timeline__line--break" aria-hidden="true"></div>
      <div class="exam-v18-timeline__item"><span>13:45</span><strong>TDAS · abre</strong><small>Entrada liberada</small></div>
      <div class="exam-v18-timeline__line" aria-hidden="true"></div>
      <div class="exam-v18-timeline__item exam-v18-timeline__item--critical"><span>14:45</span><strong>TDAS · fecha</strong><small>Sem tolerância</small></div>
    </div>`;
}

function checklistTemplate() {
  const stored = safeStorageRead();
  const items = CHECK_ITEMS.map(([id, label]) => `
    <label class="exam-v18-check ${stored[id] ? 'is-done' : ''}">
      <input type="checkbox" value="${id}" ${stored[id] ? 'checked' : ''}/>
      <span class="exam-v18-check__box" aria-hidden="true"></span>
      <span>${label}</span>
    </label>`).join('');

  return `
    <section class="exam-v18-panel exam-v18-ready" aria-labelledby="examReadyTitle">
      <div class="exam-v18-panel__head">
        <div><span class="exam-v18-kicker">ANTES DE SAIR</span><h3 id="examReadyTitle">Checklist que fica salvo neste aparelho</h3></div>
        <span class="exam-v18-progress" id="examCheckProgress">0/8 prontos</span>
      </div>
      <div class="exam-v18-checks" id="examChecks">${items}</div>
      <div class="exam-v18-ready__actions">
        <button type="button" data-check-all>Marcar tudo pronto</button>
        <button type="button" data-clear-checks>Limpar</button>
      </div>
    </section>`;
}

function rulesTemplate() {
  return `
    <section class="exam-v18-rules" aria-label="Regras e materiais para a prova">
      <article class="exam-v18-panel">
        <div class="exam-v18-panel__head"><div><span class="exam-v18-kicker">LEVAR</span><h3>Essenciais</h3></div></div>
        <ul class="exam-v18-list exam-v18-list--ok">
          <li><strong>Documento de identidade válido.</strong> Físico: original. Digital admitido: no aplicativo oficial.</li>
          <li><strong>2 ou 3 canetas</strong> esferográficas azul ou preta, de material transparente.</li>
          <li>Comprovante de inscrição provisória ou comprovante de pagamento, para apresentar se solicitado.</li>
          <li>Água e alimentos apenas em <strong>recipientes/embalagens transparentes</strong>.</li>
        </ul>
      </article>
      <article class="exam-v18-panel">
        <div class="exam-v18-panel__head"><div><span class="exam-v18-kicker">NÃO USAR / NÃO PORTAR</span><h3>Evite eliminação</h3></div></div>
        <ul class="exam-v18-list exam-v18-list--no">
          <li>Relógio de qualquer espécie, smartwatch, fones, calculadora e eletrônicos fora do porta-objetos.</li>
          <li><strong>Chaves com alarme</strong> ou componente eletrônico.</li>
          <li>Lápis, lapiseira/grafite, borracha, marca-texto, livros, anotações ou impressos.</li>
          <li>Óculos escuros, protetor auricular, acessórios de chapelaria e recipientes opacos.</li>
        </ul>
      </article>
      <article class="exam-v18-panel exam-v18-panel--critical">
        <div class="exam-v18-panel__head"><div><span class="exam-v18-kicker">REGRAS CRÍTICAS</span><h3>O que não pode dar errado</h3></div></div>
        <ul class="exam-v18-list exam-v18-list--critical">
          <li><strong>Sem tolerância:</strong> EDAS fecha 07:45; TDAS fecha 14:45.</li>
          <li>Celular e eletrônicos: <strong>completamente desligados</strong> e lacrados no porta-objetos.</li>
          <li>Documento digital: somente no <strong>aplicativo oficial</strong>; print, foto ou PDF não valem.</li>
          <li>Após entrar, dirija-se imediatamente à sala; não permaneça nos corredores antes do início.</li>
          <li>É vedado registrar respostas no comprovante de inscrição ou em meio não permitido.</li>
          <li>Permanência mínima: <strong>2 horas após o início</strong>. Caderno: apenas nos <strong>últimos 60 minutos</strong>.</li>
        </ul>
      </article>
    </section>`;
}

function template() {
  return `
    <section class="exam-v18" id="examDayControl" aria-labelledby="examDayTitle">
      <header class="exam-v18-hero">
        <div class="exam-v18-hero__copy">
          <span class="exam-v18-kicker">DIA DA PROVA · SEDES/DF</span>
          <h2 id="examDayTitle">Domingo organizado. Um turno de cada vez.</h2>
          <p>Seus dois cartões de convocação transformados em um painel operacional: horários, salas, rota, checklist e regras críticas — sem publicar CPF, RG ou número de inscrição.</p>
        </div>
        <div class="exam-v18-now" aria-label="Relógio de Brasília">
          <small>Brasília agora</small><strong id="examBrasiliaClock">--:--:--</strong><span>${EXAM_DAY.dateLabel}</span>
        </div>
      </header>

      <section class="exam-v18-next" aria-label="Próximo marco operacional">
        <div><small>Próximo marco</small><strong id="examNextLabel">Calculando…</strong></div>
        <div class="exam-v18-next__clock" id="examNextClock" role="timer" aria-label="Tempo restante para o próximo marco">--:--:--</div>
      </section>

      <section class="exam-v18-location" aria-label="Local das duas provas">
        <div><span class="exam-v18-kicker">MESMO LOCAL NOS DOIS TURNOS</span><h3>${EXAM_DAY.venue}</h3><p>${EXAM_DAY.address}</p></div>
        <div class="exam-v18-location__actions">
          <a href="${EXAM_DAY.mapsUrl}" target="_blank" rel="noreferrer">Abrir rota</a>
          <button type="button" data-copy-address>Copiar endereço</button>
          <a href="${EXAM_DAY.officialUrl}" target="_blank" rel="noreferrer">Página oficial</a>
        </div>
      </section>

      ${timeline()}
      <section class="exam-v18-turns" aria-label="Turnos da prova">${EXAM_DAY.exams.map(turnCard).join('')}</section>

      <section class="exam-v18-interval" aria-label="Intervalo entre as provas">
        <span class="exam-v18-kicker">ENTRE OS TURNOS</span>
        <div>
          <h3>Terminou a manhã? Zera o placar.</h3>
          <p>Saia do local conforme as orientações, almoce, hidrate-se, descanse e retorne ao mesmo endereço para o turno da tarde. A TDAS será em outra sala e outro andar. Não trate o intervalo como extensão da prova da manhã.</p>
        </div>
        <div class="exam-v18-interval__facts"><span><b>TDAS</b> abre 13:45</span><span><b>Sala</b> 1830</span><span><b>Andar</b> 1</span></div>
      </section>

      ${checklistTemplate()}
      ${rulesTemplate()}

      <footer class="exam-v18-foot">
        <span><strong>Fontes:</strong> seus CCIs de EDAS e TDAS + Edital nº 4. O Edital nº 5 apenas retifica o preâmbulo e mantém as demais disposições.</span>
        <span>Os documentos oficiais não informam uma hora nominal de início; por isso o painel mostra somente horários oficialmente publicados.</span>
      </footer>
    </section>`;
}

function updateProgress() {
  const checks = [...document.querySelectorAll('#examChecks input[type="checkbox"]')];
  const done = checks.filter(input => input.checked).length;
  const progress = document.getElementById('examCheckProgress');
  if (progress) progress.textContent = `${done}/${checks.length} prontos`;
}

function bindChecklist() {
  const container = document.getElementById('examChecks');
  if (!container) return;

  container.addEventListener('change', event => {
    const input = event.target.closest?.('input[type="checkbox"]');
    if (!input) return;
    const state = safeStorageRead();
    state[input.value] = input.checked;
    safeStorageWrite(state);
    input.closest('.exam-v18-check')?.classList.toggle('is-done', input.checked);
    updateProgress();
  });

  document.querySelector('[data-check-all]')?.addEventListener('click', () => {
    const state = {};
    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = true;
      state[input.value] = true;
      input.closest('.exam-v18-check')?.classList.add('is-done');
    });
    safeStorageWrite(state);
    updateProgress();
  });

  document.querySelector('[data-clear-checks]')?.addEventListener('click', () => {
    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = false;
      input.closest('.exam-v18-check')?.classList.remove('is-done');
    });
    safeStorageWrite({});
    updateProgress();
  });

  updateProgress();
}

function bindActions() {
  document.querySelector('[data-copy-address]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    try {
      await navigator.clipboard.writeText(`${EXAM_DAY.venue} — ${EXAM_DAY.address}`);
      const previous = button.textContent;
      button.textContent = 'Endereço copiado';
      window.setTimeout(() => { button.textContent = previous; }, 1800);
    } catch {
      button.textContent = 'Copie pelo texto acima';
    }
  });
}

function updateExamDay() {
  const now = Date.now();
  const next = getNextMilestone(now);
  const label = document.getElementById('examNextLabel');
  const clock = document.getElementById('examNextClock');
  const brasilia = document.getElementById('examBrasiliaClock');

  if (label) label.textContent = next.label;
  if (clock) clock.textContent = next.at ? formatRemaining(next.at - now) : 'encerrado';
  if (brasilia) brasilia.textContent = getBrasiliaClock(new Date(now));

  EXAM_DAY.exams.forEach(exam => {
    const node = document.querySelector(`[data-exam-status="${exam.id}"]`);
    if (!node) return;
    const status = examStatus(exam, now);
    node.textContent = status.text;
    node.classList.remove('exam-v18-status--waiting', 'exam-v18-status--open', 'exam-v18-status--closed');
    node.classList.add(`exam-v18-status--${status.state}`);
  });
}

function mountExamDay() {
  if (document.getElementById('examDayControl')) return;
  const mission = document.querySelector('.mission-strip');
  if (!mission) return;
  mission.insertAdjacentHTML('afterend', template());
  bindChecklist();
  bindActions();
  updateExamDay();
  window.setInterval(updateExamDay, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountExamDay, { once: true });
} else {
  mountExamDay();
}
