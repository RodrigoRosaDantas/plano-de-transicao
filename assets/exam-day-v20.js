const APPLICATION_SCHEDULE = {
  edas: {
    start: 'Não divulgado oficialmente',
    end: '4h após o início efetivo',
    detail: 'EDAS · turno da manhã. Os documentos oficiais publicam 06:45–07:45 para os portões e duração de 4h, mas não fixam uma hora nominal de início.'
  },
  tdas: {
    start: 'Não divulgado oficialmente',
    end: '4h após o início efetivo',
    detail: 'TDAS · turno da tarde. Os documentos oficiais publicam 13:45–14:45 para os portões e duração de 4h, mas não fixam uma hora nominal de início.'
  }
};

function applicationBlock(examId) {
  const data = APPLICATION_SCHEDULE[examId];
  if (!data) return '';
  return `
    <section class="exam-v20-application" data-application-time="${examId}" aria-label="Horário da aplicação ${examId.toUpperCase()}">
      <div class="exam-v20-application__title">
        <small>HORÁRIO DA APLICAÇÃO</small>
        <strong>Não confundir fechamento do portão com início da prova</strong>
      </div>
      <div class="exam-v20-application__grid">
        <div><span>Início da aplicação</span><b>${data.start}</b></div>
        <div><span>Término</span><b>${data.end}</b></div>
      </div>
      <p>${data.detail}</p>
      <p class="exam-v20-application__warning"><strong>Importante:</strong> 08:00–12:00 e 15:00–19:00 não devem ser tratados como horários oficiais enquanto não houver publicação expressa do Instituto Quadrix.</p>
    </section>`;
}

function enhanceApplicationTimes() {
  let changed = false;
  document.querySelectorAll('.exam-v18-turn').forEach(card => {
    const examId = card.classList.contains('exam-v18-turn--edas') ? 'edas' : card.classList.contains('exam-v18-turn--tdas') ? 'tdas' : null;
    if (!examId || card.querySelector('[data-application-time]')) return;
    const meta = card.querySelector('.exam-v18-meta');
    if (!meta) return;
    meta.insertAdjacentHTML('beforebegin', applicationBlock(examId));
    changed = true;
  });
  return changed;
}

function mountApplicationTimes() {
  if (enhanceApplicationTimes()) return;
  const observer = new MutationObserver(() => {
    if (enhanceApplicationTimes()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 10000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApplicationTimes, { once: true });
} else {
  mountApplicationTimes();
}
