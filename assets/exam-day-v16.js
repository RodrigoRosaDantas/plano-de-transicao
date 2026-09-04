const EXAM_DAY = {
  dateLabel: 'DOMINGO · 06/09/2026',
  venue: 'Centro de Ensino Fundamental Telebrasília — Riacho Fundo I',
  address: 'QN 1, Área Especial 1, Lote 01/02, Praça Central, Riacho Fundo I — Brasília/DF',
  officialUrl: 'https://quadrix.org.br/informacoes/3056/',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Centro%20de%20Ensino%20Fundamental%20Telebras%C3%ADlia%20Riacho%20Fundo%20I%20Bras%C3%ADlia%20DF',
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

function getNextMilestone(now = Date.now()) {
  const milestones = [];
  EXAM_DAY.exams.forEach(exam => {
    milestones.push({ at: new Date(exam.openIso).getTime(), label: `Abertura dos portões · ${exam.code}` });
    milestones.push({ at: new Date(exam.closeIso).getTime(), label: `FECHAMENTO DOS PORTÕES · ${exam.code}` });
  });
  const next = milestones.find(item => item.at > now);
  if (next) return next;
  return { at: null, label: 'Cronograma de acesso de 06/09 encerrado' };
}

function examStatus(exam, now = Date.now()) {
  const opens = new Date(exam.openIso).getTime();
  const closes = new Date(exam.closeIso).getTime();
  if (now < opens) return `Portões abrem às ${exam.open}`;
  if (now >= opens && now < closes) return `ENTRADA LIBERADA · fecha ${exam.close}`;
  return `Portões fechados desde ${exam.close}`;
}

function examCard(exam) {
  return `
    <article class="exam-card ${exam.id}" data-exam-card="${exam.id}">
      <div class="exam-card-top">
        <span class="exam-card-tag">${exam.code}</span>
        <span class="exam-card-status" data-exam-status="${exam.id}">${examStatus(exam)}</span>
      </div>
      <h3>${exam.title}</h3>
      <p>${exam.turn} · 06 de setembro · duração oficial de 4 horas</p>
      <div class="exam-time-strip" aria-label="Janela de acesso ${exam.code}">
        <div class="exam-time-node"><small>Abertura</small><strong>${exam.open}</strong></div>
        <span class="exam-time-arrow">→</span>
        <div class="exam-time-node"><small>Fechamento</small><strong>${exam.close}</strong></div>
      </div>
      <div class="exam-meta">
        <div><span>Sala</span><strong>${exam.room}</strong></div>
        <div><span>Bloco</span><strong>${exam.block}</strong></div>
        <div><span>Andar</span><strong>${exam.floor}</strong></div>
      </div>
      <div class="exam-application-note"><b>Aplicação:</b> turno da ${exam.turn.toLowerCase()}, com 4h de duração. O CCI e o Edital nº 4 não publicam uma hora nominal de início; depois do fechamento dos portões, siga as orientações da equipe de sala.</div>
      <div class="exam-card-actions">
        <a href="${EXAM_DAY.mapsUrl}" target="_blank" rel="noreferrer">Abrir rota</a>
        <button type="button" data-open-exam-checklist>Ver checklist</button>
      </div>
    </article>`;
}

function template() {
  return `
    <section class="exam-day-control" id="examDayControl" aria-labelledby="examDayTitle">
      <div class="exam-day-header">
        <div class="exam-day-heading">
          <span class="eyebrow">DIA DA PROVA · SEDES/DF</span>
          <h2 id="examDayTitle">Operação 06 SET — dois turnos, mesmo local</h2>
          <p>Horários, salas, regras críticas e checklist operacional dos seus CCIs. Dados pessoais como CPF, RG e números de inscrição não são publicados neste site.</p>
        </div>
        <div class="exam-day-live"><i></i><span><b>${EXAM_DAY.dateLabel}</b><small>Horário oficial de Brasília</small></span></div>
      </div>

      <div class="exam-day-next">
        <div class="exam-day-countdown">
          <div class="exam-day-countdown-copy"><span>Próximo marco operacional</span><strong id="examNextLabel">Calculando…</strong></div>
          <div class="exam-day-clock" id="examNextClock" aria-live="polite">--:--:--</div>
        </div>
        <div class="exam-day-location">
          <span>Local das duas provas</span>
          <strong>${EXAM_DAY.venue}</strong>
          <small>${EXAM_DAY.address}</small>
        </div>
      </div>

      <div class="exam-day-grid">${EXAM_DAY.exams.map(examCard).join('')}</div>

      <details class="exam-day-checklist" id="examDayChecklist">
        <summary><b>Checklist final de prova</b><span>Documento, canetas, alimentos, eletrônicos e regras de saída</span></summary>
        <div class="exam-check-grid">
          <section class="exam-check-group">
            <h4>Levar</h4>
            <ul>
              <li><strong>Documento original de identidade válido.</strong></li>
              <li><strong>2 ou 3 canetas</strong> azul ou preta, de material transparente.</li>
              <li>Comprovante de inscrição provisória ou comprovante de pagamento, para apresentação se solicitado.</li>
              <li>Água e alimentos somente em <strong>recipientes/embalagens transparentes</strong>.</li>
            </ul>
          </section>
          <section class="exam-check-group">
            <h4>Não portar/utilizar</h4>
            <ul>
              <li>Relógio de qualquer espécie, smartwatch, fones, calculadora e demais eletrônicos.</li>
              <li>Lápis, lapiseira/grafite, borracha, marca-texto, livros, anotações ou impressos.</li>
              <li>Óculos escuros, protetor auricular e acessórios de chapelaria.</li>
              <li>Recipientes opacos e objetos cortantes/perfurantes.</li>
            </ul>
          </section>
          <section class="exam-check-group exam-check-critical">
            <h4>Regras críticas</h4>
            <ul>
              <li><strong>Sem tolerância:</strong> EDAS fecha 07:45; TDAS fecha 14:45.</li>
              <li>Celular e eletrônicos devem ficar <strong>completamente desligados</strong> e lacrados no porta-objetos.</li>
              <li>Documento digital só vale no <strong>aplicativo oficial</strong>; print, foto e PDF não valem.</li>
              <li>Permanência mínima de <strong>2 horas após o início</strong> da aplicação.</li>
              <li>Caderno de provas somente pode ser levado nos <strong>últimos 60 minutos</strong>.</li>
            </ul>
          </section>
        </div>
      </details>

      <div class="exam-day-foot">
        <span><b>Fonte operacional:</b> seus dois Cartões de Convocação Individual + Edital nº 4 de convocação. Retificação nº 5 não altera estes horários.</span>
        <a href="${EXAM_DAY.officialUrl}" target="_blank" rel="noreferrer">Abrir página oficial do concurso</a>
      </div>
    </section>`;
}

function mountExamDay() {
  if (document.getElementById('examDayControl')) return;
  const mission = document.querySelector('.mission-strip');
  if (!mission) return;
  mission.insertAdjacentHTML('afterend', template());

  document.querySelectorAll('[data-open-exam-checklist]').forEach(button => {
    button.addEventListener('click', () => {
      const details = document.getElementById('examDayChecklist');
      if (!details) return;
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  updateExamDay();
  window.setInterval(updateExamDay, 1000);
}

function updateExamDay() {
  const now = Date.now();
  const next = getNextMilestone(now);
  const label = document.getElementById('examNextLabel');
  const clock = document.getElementById('examNextClock');
  if (label) label.textContent = next.label;
  if (clock) clock.textContent = next.at ? formatRemaining(next.at - now) : 'encerrado';

  EXAM_DAY.exams.forEach(exam => {
    const node = document.querySelector(`[data-exam-status="${exam.id}"]`);
    if (node) node.textContent = examStatus(exam, now);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountExamDay, { once: true });
} else {
  mountExamDay();
}
