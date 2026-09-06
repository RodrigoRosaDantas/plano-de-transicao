(() => {
  const POST_EXAM_AT = Date.parse('2026-09-06T22:30:00.000Z'); // 19:30 em Brasília
  const postExamActive = () => Date.now() >= POST_EXAM_AT;

  function normalizePostExamSnapshot(data) {
    if (!postExamActive() || !data || typeof data !== 'object') return data;

    data.meta = {
      ...(data.meta || {}),
      phase: 'post-exam',
      nextExam: null,
      postExamDate: '2026-09-06'
    };

    data.mission = 'Transformar as provas realizadas em diagnóstico, correção, recursos, resultado e próxima decisão de carreira.';

    if (Array.isArray(data.priorities)) {
      data.priorities = data.priorities.map((item) => {
        if (item?.id === 'tdas' || item?.id === 'edas') {
          return { ...item, status: 'Prova realizada · aguardando correção oficial' };
        }
        return item;
      });
    }

    if (Array.isArray(data.exams)) {
      data.exams = data.exams.map((exam) => String(exam?.name || '').includes('SEDES')
        ? { ...exam, status: 'Provas realizadas em 06/09/2026 · aguardando gabarito e resultado' }
        : exam);
    }

    data.strategy = {
      ...(data.strategy || {}),
      current: 'As provas SEDES/DF foram concluídas em 06/09/2026. A prioridade agora é registrar a prova, corrigir pelo gabarito oficial, identificar recursos, calcular o resultado e só então decidir o próximo alvo.'
    };

    data.postExam = data.postExam || {
      phase: 'active',
      examDate: '2026-09-06',
      examsCompleted: ['EDAS · Cargo 400', 'TDAS · Cargo 202'],
      resultState: 'Aguardando gabarito e resultado oficiais',
      scoreState: 'Não calculado sem gabarito oficial'
    };

    return data;
  }

  // Normaliza o snapshot antes de work-app.js consumi-lo. Isso impede regressão visual
  // enquanto a fonte editorial ainda estiver com textos de pré-prova.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    if (!postExamActive()) return response;

    const input = args[0];
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    if (!/data\/snapshot\.json(?:\?|$)/.test(requestUrl)) return response;

    try {
      const data = normalizePostExamSnapshot(await response.clone().json());
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.set('content-type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify(data, null, 2), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch {
      return response;
    }
  };

  function patchPostExamDom() {
    if (!postExamActive()) return;

    document.body?.classList.add('post-exam-active');

    const mission = document.querySelector('.mission-strip');
    if (mission && mission.dataset.postExamPatched !== '1') {
      mission.dataset.postExamPatched = '1';
      const eyebrow = mission.querySelector('.mission-copy .eyebrow');
      const title = mission.querySelector('.mission-copy h1');
      const text = mission.querySelector('#missionText');
      const milestone = mission.querySelector('#nextMilestone');
      if (eyebrow) eyebrow.textContent = 'FASE ATUAL · PÓS-PROVA SEDES/DF';
      if (title) title.innerHTML = 'Provas concluídas. Agora começa a fase de <em>correção, recurso e resultado.</em>';
      if (text) text.textContent = 'EDAS e TDAS foram realizadas em 06/09/2026. O foco agora é registrar a prova, confrontar o gabarito oficial, auditar recursos e acompanhar o resultado sem inventar nota ou classificação.';
      if (milestone) milestone.innerHTML = '<span>Próximo marco</span><strong>GABARITO</strong><small>correção + recursos</small>';
    }

    const command = document.querySelector('.command-view');
    if (command && command.dataset.postExamPatched !== '1') {
      command.dataset.postExamPatched = '1';

      const card = document.createElement('article');
      card.id = 'postExamStateCard';
      card.className = 'panel action-card';
      card.innerHTML = '<div><span class="eyebrow">PÓS-PROVA · 06/09/2026</span><h2>EDAS e TDAS concluídas.</h2></div><p>O ciclo de preparação fechou. A próxima régua é objetiva: prova registrada, gabarito auditado, recursos separados, nota calculada e resultado acompanhado.</p><div class="command-actions"><button class="primary-button" type="button" data-view="exams">Ver provas</button><button class="secondary-button" type="button" data-view="performance">Fechar diagnóstico</button><button class="secondary-button" type="button" data-view="strategy">Próxima decisão</button></div>';
      command.prepend(card);

      const countdown = command.querySelector('.countdown-card');
      if (countdown) {
        const kicker = countdown.querySelector('.section-kicker');
        const label = countdown.querySelector('.countdown-value span');
        const description = countdown.querySelector('p');
        if (kicker) kicker.lastChild.textContent = ' Ciclo SEDES/DF';
        if (label) label.textContent = 'provas concluídas';
        if (description) description.textContent = 'A contagem terminou. Agora o plano passa para correção, recursos, resultado e decisão seguinte.';
      }

      command.querySelectorAll('.journey-node').forEach((node) => {
        const label = node.querySelector('strong')?.textContent?.trim();
        if (label === 'SEDES/DF') {
          node.classList.remove('active');
          node.classList.add('done');
        }
        if (label === 'Resultado') node.classList.add('active');
      });
    }

    const examDay = document.querySelector('[data-exam21-view]');
    if (examDay && examDay.dataset.postExamPatched !== '1') {
      examDay.dataset.postExamPatched = '1';
      const heroTitle = examDay.querySelector('.exam21-hero h2');
      const heroText = examDay.querySelector('.exam21-hero__copy > p');
      if (heroTitle) heroTitle.innerHTML = 'Provas concluídas, <em>registro preservado.</em>';
      if (heroText) heroText.textContent = 'Os horários, salas, regras e checklist ficam preservados como registro do dia 06/09/2026. O cronograma de entrada está encerrado; a fase atual é correção e resultado.';
    }
  }

  let patchQueued = false;
  const queuePatch = () => {
    if (patchQueued) return;
    patchQueued = true;
    requestAnimationFrame(() => {
      patchQueued = false;
      patchPostExamDom();
    });
  };

  if (postExamActive()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queuePatch, { once: true });
    else queuePatch();

    window.addEventListener('hashchange', queuePatch);
    const observer = new MutationObserver(queuePatch);
    document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, { childList: true, subtree: true }), { once: true });
  }

  const directExamDay = location.hash === '#exam-day';
  window.__EXAM_DAY_DIRECT_ENTRY__ = directExamDay;
  if (!directExamDay) return;

  const restoreExamDay = () => {
    if (location.hash !== '#exam-day') history.replaceState(null, '', '#exam-day');
    // A camada v21 já terá registrado o listener quando este timer executar.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  // Registrado no <head>: executa depois dos listeners DOMContentLoaded dos módulos,
  // evitando que o roteador-base apague o deep link antes da camada v21 assumir a view.
  window.addEventListener('DOMContentLoaded', () => window.setTimeout(restoreExamDay, 0), { once: true });
  window.addEventListener('load', () => window.setTimeout(restoreExamDay, 0), { once: true });
})();
