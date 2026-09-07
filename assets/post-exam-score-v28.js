(() => {
  let snapshot = window.__planoPublishedSnapshot || null;
  let queued = false;

  function tdasExam(data = snapshot) {
    return (data?.exams || []).find(exam => exam?.id === 'sedes-2026-tdas') || null;
  }

  function scoreState(data = snapshot) {
    const exam = tdasExam(data);
    const response = exam?.candidateResponse;
    const preliminary = exam?.scoreTracking?.preliminary || data?.postExam?.scoring?.tdas?.preliminary || null;
    const definitive = exam?.scoreTracking?.definitive || data?.postExam?.scoring?.tdas?.definitive || null;
    return { exam, response, preliminary, definitive };
  }

  function patch(data = snapshot) {
    const { response, preliminary, definitive } = scoreState(data);
    const card = document.querySelector('.v27-exam-card--tdas');
    if (!card || !response) return;

    card.dataset.scoreTrackingV28 = '1';
    const result = card.querySelector('.v27-exam-result');
    if (!result) return;

    const label = result.querySelector('small');
    const strong = result.querySelector('strong');
    const detail = result.querySelector('span');

    if (definitive) {
      if (label) label.textContent = 'Gabarito definitivo';
      if (strong) strong.textContent = `${definitive.total ?? definitive.totalScore}/100`;
      if (detail) detail.textContent = `CG ${definitive.general ?? definitive.generalScore}/20 · CE ${definitive.specific ?? definitive.specificScore}/80`;
    } else if (preliminary) {
      if (label) label.textContent = 'Nota objetiva estimada';
      if (strong) strong.textContent = `${preliminary.total ?? preliminary.totalScore}/100`;
      if (detail) detail.textContent = `CG ${preliminary.general ?? preliminary.generalScore}/20 · CE ${preliminary.specific ?? preliminary.specificScore}/80 · preliminar`;
    } else {
      if (label) label.textContent = 'Gabarito do candidato pronto';
      if (strong) strong.textContent = `${response.validMarks || 0} válidas · ${(response.invalidQuestions || []).length} inválida`;
      if (detail) detail.textContent = 'Aguardando gabarito preliminar oficial · previsão 09/09/2026';
    }

    let note = card.querySelector('[data-v28-score-note]');
    if (!note) {
      note = document.createElement('p');
      note.dataset.v28ScoreNote = '1';
      note.className = 'v27-archive-note';
      result.insertAdjacentElement('afterend', note);
    }
    note.textContent = (response.invalidQuestions || []).includes(30)
      ? 'Q30: dupla marca no cartão; vale 0 ponto, salvo eventual anulação da questão pela banca.'
      : 'Respostas do candidato registradas para cruzamento com o gabarito oficial.';
  }

  function schedule(data = snapshot) {
    if (data) snapshot = data;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patch(snapshot);
    });
  }

  async function load() {
    try {
      const response = await fetch(`data/snapshot.json?v28=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) snapshot = await response.json();
    } catch {}
    schedule(snapshot);
  }

  window.addEventListener('plano:snapshot-loaded', event => schedule(event.detail || snapshot));
  window.addEventListener('hashchange', () => window.setTimeout(() => schedule(), 0));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-refresh]') || event.target.closest('[data-exam-day-tab]')) {
      window.setTimeout(load, 700);
    }
  });

  const observer = new MutationObserver(() => schedule());
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
      load();
    }, { once: true });
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
    load();
  }
})();
