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

  function ensureResourceHubStyles() {
    if (document.getElementById('post-exam-resource-hub-v39')) return;
    const style = document.createElement('style');
    style.id = 'post-exam-resource-hub-v39';
    style.textContent = `
      .postexam-resource-hub {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 24px;
        align-items: center;
        margin: 0 0 22px;
        padding: clamp(20px, 3vw, 30px);
        border: 1px solid color-mix(in srgb, var(--lime) 38%, var(--border));
        border-radius: 24px 24px 24px 8px;
        background: linear-gradient(135deg, color-mix(in srgb, var(--lime) 10%, var(--surface)), color-mix(in srgb, var(--aqua) 5%, var(--surface)));
        box-shadow: var(--shadow);
      }
      .postexam-resource-hub__copy { min-width: 0; }
      .postexam-resource-hub__eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--lime);
        font-size: .68rem;
        font-weight: 850;
        letter-spacing: .14em;
        text-transform: uppercase;
      }
      .postexam-resource-hub h3 {
        margin: 8px 0 8px;
        font-size: clamp(1.35rem, 2vw, 1.8rem);
        letter-spacing: -.04em;
      }
      .postexam-resource-hub p {
        max-width: 760px;
        margin: 0;
        color: var(--muted);
        font-size: .76rem;
        line-height: 1.6;
      }
      .postexam-resource-hub__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }
      .postexam-resource-hub__meta span {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 0 10px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: color-mix(in srgb, var(--surface-2) 88%, transparent);
        color: color-mix(in srgb, var(--paper) 78%, transparent);
        font-size: .64rem;
        font-weight: 760;
      }
      .postexam-resource-hub__action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 0 18px;
        border: 1px solid color-mix(in srgb, var(--lime) 45%, transparent);
        border-radius: 14px;
        background: var(--lime);
        color: var(--ink);
        font-size: .72rem;
        font-weight: 850;
        text-decoration: none;
        white-space: nowrap;
        transition: transform .18s ease, filter .18s ease;
      }
      .postexam-resource-hub__action:hover { filter: brightness(1.04); transform: translateY(-1px); }
      .postexam-resource-hub__action:active { transform: translateY(0); }
      @media (max-width: 760px) {
        .postexam-resource-hub { grid-template-columns: 1fr; gap: 18px; }
        .postexam-resource-hub__action { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function removeStandaloneResourceNavigation() {
    document.querySelectorAll('button[onclick*="recursos-sedes.html"]').forEach((button) => button.remove());
  }

  function ensurePostExamResourceHub() {
    const host = document.querySelector('[data-post-exam-page]');
    if (!host || host.querySelector('[data-postexam-resource-hub]')) return;

    ensureResourceHubStyles();

    const card = document.createElement('section');
    card.className = 'postexam-resource-hub';
    card.dataset.postexamResourceHub = 'true';
    card.setAttribute('aria-label', 'Recursos SEDES/DF');
    card.innerHTML = `
      <div class="postexam-resource-hub__copy">
        <span class="postexam-resource-hub__eyebrow">RECURSOS · SEDES/DF</span>
        <h3>5 recursos protocolados · todos em análise</h3>
        <p>TDAS Tipo B: Q14. EDAS Tipo A: Q20, Q43, Q47 e Q59. O detalhe completo de cada protocolo, pedido e fundamento fica na Sala de Recursos.</p>
        <div class="postexam-resource-hub__meta"><span>TDAS · 1 recurso</span><span>EDAS · 4 recursos</span><span>situação · Em análise</span></div>
      </div>
      <a class="postexam-resource-hub__action" href="./recursos-sedes.html">Ver protocolos e fundamentos →</a>
    `;

    const followUpPanel = host.querySelector('[data-v28-post-followup]');
    if (followUpPanel) {
      followUpPanel.insertAdjacentElement('beforebegin', card);
      return;
    }

    const heading = host.querySelector('.view-heading, .postexam-hero, [data-post-exam-hero]');
    if (heading) heading.insertAdjacentElement('afterend', card);
    else host.prepend(card);
  }

  function patchPostExamDom() {
    if (!postExamActive() || !window.__PLANO_SEPARATE_POST_EXAM__) return;
    document.documentElement.dataset.planPhase = 'post-exam';
    removeStandaloneResourceNavigation();
    ensurePostExamResourceHub();
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
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };

  window.addEventListener('DOMContentLoaded', () => window.setTimeout(restoreExamDay, 0), { once: true });
  window.addEventListener('load', () => window.setTimeout(restoreExamDay, 0), { once: true });
})();