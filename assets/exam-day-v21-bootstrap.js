(() => {
  const POST_EXAM_AT = Date.parse('2026-09-06T22:30:00.000Z'); // 19:30 em Brasília
  const postExamActive = () => Date.now() >= POST_EXAM_AT;
  const POST_EXAM_NOTE_KEY = 'plano-transicao:post-exam-v27:notes';

  function seedPostExamNotesFromSnapshot(data) {
    if (!postExamActive() || !data || typeof data !== 'object') return;
    const tdasNote = String((data.exams || []).find((exam) => exam?.id === 'sedes-2026-tdas')?.postExamNote || '').trim();
    const edasNote = String((data.exams || []).find((exam) => exam?.id === 'sedes-2026-edas')?.postExamNote || '').trim();
    if (!tdasNote && !edasNote) return;
    try {
      const current = JSON.parse(localStorage.getItem(POST_EXAM_NOTE_KEY) || '{}');
      const notes = current && typeof current === 'object' ? current : {};
      let changed = false;
      if (tdasNote && !String(notes.tdas || '').trim()) {
        notes.tdas = tdasNote;
        notes.tdasSource = 'Registro Histórico — Estudos e Desempenho / Notion';
        changed = true;
      }
      if (edasNote && !String(notes.edas || '').trim()) {
        notes.edas = edasNote;
        notes.edasSource = 'Registro Histórico — Estudos e Desempenho / Notion';
        changed = true;
      }
      if (changed) {
        notes.updatedAt = new Date().toISOString();
        localStorage.setItem(POST_EXAM_NOTE_KEY, JSON.stringify(notes));
      }
    } catch {
      // O site continua funcional mesmo se o navegador bloquear localStorage.
    }
  }

  function normalizePostExamSnapshot(data) {
    if (!postExamActive() || !data || typeof data !== 'object') return data;

    data.meta = {
      ...(data.meta || {}),
      phase: 'post-exam',
      nextExam: null,
      postExamDate: '2026-09-06'
    };

    data.mission = 'Acompanhar dados, desempenho e decisões da transição, preservando o capital acumulado até o próximo concurso.';

    if (Array.isArray(data.priorities)) {
      data.priorities = data.priorities.map((item) => {
        if (item?.id === 'tdas' || item?.id === 'edas') {
          return { ...item, status: 'Capital preservado · ciclo em acompanhamento separado' };
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
      seedPostExamNotesFromSnapshot(data);
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
    if (!postExamActive() || !window.__PLANO_SEPARATE_POST_EXAM__) return;
    // A Home neutra é renderizada pelo roteador principal. O pós-prova vive em #post-exam.
    document.documentElement.dataset.planPhase = 'post-exam';
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

  const separatePostExam = Boolean(window.__PLANO_SEPARATE_POST_EXAM__);
  const directExamDay = location.hash === '#exam-day' && !separatePostExam;
  if (separatePostExam && location.hash === '#exam-day') history.replaceState(null, '', '#post-exam');
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
