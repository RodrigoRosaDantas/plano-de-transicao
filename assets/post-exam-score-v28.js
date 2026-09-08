(() => {
  const SYNC_WORKFLOW_URL = 'https://github.com/RodrigoRosaDantas/plano-de-transicao/actions/workflows/sync-notion.yml';
  let snapshot = window.__planoPublishedSnapshot || null;
  let queued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function sedesExam(id, data = snapshot) {
    return (data?.exams || []).find(exam => exam?.id === `sedes-2026-${id}`) || null;
  }

  function scoreState(id, data = snapshot) {
    const exam = sedesExam(id, data);
    const response = exam?.candidateResponse;
    const preliminary = exam?.scoreTracking?.preliminary || data?.postExam?.scoring?.[id]?.preliminary || null;
    const definitive = exam?.scoreTracking?.definitive || data?.postExam?.scoring?.[id]?.definitive || null;
    return { exam, response, preliminary, definitive };
  }

  function hasCorrection(exam) {
    return Boolean(exam?.rawAccuracy != null || (exam?.score && exam.score !== '—') || exam?.scoreTracking?.preliminary || exam?.scoreTracking?.definitive);
  }

  function hasRanking(exam) {
    return Boolean(exam?.ranking && exam.ranking !== '—');
  }

  function snapshotAge(data = snapshot) {
    const generatedAt = data?.meta?.generatedAt;
    if (!generatedAt) return { label: 'idade desconhecida', stale: true, minutes: null };
    const generated = new Date(generatedAt).getTime();
    if (!Number.isFinite(generated)) return { label: 'idade desconhecida', stale: true, minutes: null };
    const minutes = Math.max(0, Math.floor((Date.now() - generated) / 60000));
    if (minutes < 2) return { label: 'agora', stale: false, minutes };
    if (minutes < 60) return { label: `há ${minutes} min`, stale: false, minutes };
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return { label: `há ${hours} h`, stale: hours >= 4, minutes };
    const days = Math.floor(hours / 24);
    return { label: `há ${days} d`, stale: true, minutes };
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function answerVector(response) {
    return Object.entries(response?.answers || {})
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([number, answer]) => `${String(number).padStart(2, '0')}=${answer || 'INVÁLIDA'}`)
      .join(' · ');
  }

  function ensureStyles() {
    if (document.getElementById('v28-product-upgrade-styles')) return;
    const style = document.createElement('style');
    style.id = 'v28-product-upgrade-styles';
    style.textContent = `
      .v28-transition-console{display:grid;gap:18px;padding:24px!important;overflow:hidden;position:relative}
      .v28-transition-console:before{content:"";position:absolute;inset:0 auto auto 0;width:100%;height:2px;background:linear-gradient(90deg,var(--accent,#b9ff59),#64d8cf,transparent);opacity:.75}
      .v28-console-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
      .v28-console-head h2{margin:.25rem 0 .45rem;font-size:clamp(1.45rem,3vw,2rem);line-height:1.08}
      .v28-console-head p{margin:0;color:var(--text-muted,#969d99);max-width:72ch;line-height:1.55}
      .v28-live-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--line,#29312e);border-radius:999px;color:var(--text-muted,#969d99);white-space:nowrap;font-size:.78rem}
      .v28-live-chip i{width:7px;height:7px;border-radius:50%;background:#64d8cf;box-shadow:0 0 0 4px color-mix(in srgb,#64d8cf 10%,transparent)}
      .v28-flow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}
      .v28-flow-step{min-width:0;padding:13px;border:1px solid var(--line,#29312e);border-radius:15px;background:color-mix(in srgb,var(--surface-2,#111816) 84%,transparent)}
      .v28-flow-step span,.v28-flow-step small{display:block;color:var(--text-muted,#8f9793)}
      .v28-flow-step span{font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .v28-flow-step strong{display:block;margin:5px 0 4px;line-height:1.2}
      .v28-flow-step.done{border-color:color-mix(in srgb,#64d8cf 32%,var(--line,#29312e))}
      .v28-flow-step.done span{color:#64d8cf}
      .v28-flow-step.current{border-color:color-mix(in srgb,var(--accent,#b9ff59) 46%,var(--line,#29312e));background:color-mix(in srgb,var(--accent,#b9ff59) 5%,var(--surface-2,#111816))}
      .v28-flow-step.current span{color:var(--accent,#b9ff59)}
      .v28-next-lanes{display:grid;grid-template-columns:minmax(0,1fr) repeat(2,minmax(190px,.62fr));gap:10px}
      .v28-lane-intro,.v28-lane{padding:16px;border:1px solid var(--line,#29312e);border-radius:17px;background:var(--surface-2,#111816)}
      .v28-lane-intro span,.v28-lane span{display:block;color:var(--text-muted,#8f9793);font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .v28-lane-intro strong,.v28-lane strong{display:block;margin:5px 0;font-size:1rem}
      .v28-lane-intro p,.v28-lane small{margin:0;color:var(--text-muted,#8f9793);line-height:1.45}
      .v28-lane{cursor:pointer;text-align:left;color:inherit;font:inherit}
      .v28-lane:hover{border-color:color-mix(in srgb,#64d8cf 35%,var(--line,#29312e));transform:translateY(-1px)}
      .v28-source-sync{display:inline-flex!important;align-items:center;justify-content:center;gap:7px;text-decoration:none}
      .v28-source-sync:after{content:"↗";font-size:.9em}
      .v28-sync-note{margin-top:10px!important;font-size:.78rem!important;color:var(--text-muted,#8f9793)!important}
      .v28-answer-vector{margin-top:10px;padding-top:10px;border-top:1px solid var(--line,#29312e)}
      .v28-answer-vector summary{cursor:pointer;color:var(--text-muted,#8f9793);font-size:.78rem;font-weight:800;list-style:none}
      .v28-answer-vector summary::-webkit-details-marker{display:none}
      .v28-answer-vector summary:after{content:" +";font-weight:500}
      .v28-answer-vector[open] summary:after{content:" −"}
      .v28-answer-vector code{display:block;margin-top:8px;white-space:normal;overflow-wrap:anywhere;color:var(--text-muted,#8f9793);font-size:.72rem;line-height:1.65;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
      @media(max-width:900px){.v28-flow{grid-template-columns:repeat(2,minmax(0,1fr))}.v28-flow-step:last-child{grid-column:1/-1}.v28-next-lanes{grid-template-columns:1fr 1fr}.v28-lane-intro{grid-column:1/-1}}
      @media(max-width:620px){.v28-transition-console{padding:18px!important}.v28-console-head{display:block}.v28-live-chip{margin-top:12px}.v28-flow{grid-template-columns:1fr}.v28-flow-step:last-child{grid-column:auto}.v28-next-lanes{grid-template-columns:1fr}.v28-lane-intro{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function patchScoreCard(id, data = snapshot) {
    const { response, preliminary, definitive } = scoreState(id, data);
    const card = document.querySelector(`.v27-exam-card--${id}`);
    if (!card || !response) return;

    card.dataset.scoreTrackingV28 = '1';
    const result = card.querySelector('.v27-exam-result');
    if (!result) return;

    const label = result.querySelector('small');
    const strong = result.querySelector('strong');
    const detail = result.querySelector('span');

    if (definitive) {
      setText(label, 'Gabarito definitivo');
      setText(strong, `${definitive.total ?? definitive.totalScore}/100`);
      setText(detail, `CG ${definitive.general ?? definitive.generalScore}/20 · CE ${definitive.specific ?? definitive.specificScore}/80`);
    } else if (preliminary) {
      setText(label, 'Nota objetiva estimada');
      setText(strong, `${preliminary.total ?? preliminary.totalScore}/100`);
      setText(detail, `CG ${preliminary.general ?? preliminary.generalScore}/20 · CE ${preliminary.specific ?? preliminary.specificScore}/80 · preliminar`);
    } else {
      const invalidCount = (response.invalidQuestions || []).length;
      setText(label, id === 'edas' ? 'Respostas anotadas do candidato' : 'Gabarito do candidato pronto');
      setText(strong, `${response.validMarks || 0} válidas · ${invalidCount} ${invalidCount === 1 ? 'inválida' : 'inválidas'}`);
      setText(detail, 'Aguardando gabarito preliminar oficial · previsão 09/09/2026');
    }

    let note = card.querySelector(`[data-v28-score-note="${id}"]`);
    if (!note) {
      note = document.createElement('p');
      note.dataset.v28ScoreNote = id;
      note.className = 'v27-archive-note';
      result.insertAdjacentElement('afterend', note);
    }
    if (id === 'tdas' && (response.invalidQuestions || []).includes(30)) {
      setText(note, 'Q30: dupla marca no cartão; vale 0 ponto, salvo eventual anulação da questão pela banca.');
    } else if (id === 'edas') {
      setText(note, 'EDAS 400: 60 respostas anotadas da foto enviada em 08/09/2026. Este registro é do candidato e não é gabarito oficial.');
    } else {
      setText(note, 'Respostas do candidato registradas para cruzamento com o gabarito oficial.');
    }

    let vector = card.querySelector(`[data-v28-answer-vector="${id}"]`);
    if (!vector) {
      vector = document.createElement('details');
      vector.className = 'v28-answer-vector';
      vector.dataset.v28AnswerVector = id;
      vector.innerHTML = `<summary>Ver ${response.registeredQuestions || 0} respostas registradas</summary><code></code>`;
      note.insertAdjacentElement('afterend', vector);
    }
    const code = vector.querySelector('code');
    setText(code, answerVector(response));
  }

  function stageModel(data = snapshot) {
    const edas = sedesExam('edas', data);
    const tdas = sedesExam('tdas', data);
    const edasState = scoreState('edas', data);
    const tdasState = scoreState('tdas', data);
    const preliminary = edasState.preliminary || tdasState.preliminary;
    const definitive = edasState.definitive || tdasState.definitive;
    const anyCorrection = hasCorrection(edas) || hasCorrection(tdas) || preliminary || definitive;
    const anyRanking = hasRanking(edas) || hasRanking(tdas);
    const hasOfficialKey = Boolean(preliminary || definitive || anyCorrection);

    return [
      { label: 'Provas', detail: '2 de 2 realizadas', state: 'done' },
      { label: 'Gabarito', detail: hasOfficialKey ? 'publicação incorporada' : 'aguardando banca', state: hasOfficialKey ? 'done' : 'current' },
      { label: 'Correção', detail: anyCorrection ? 'cruzamento disponível' : 'depois do gabarito', state: anyCorrection ? 'done' : hasOfficialKey ? 'current' : 'pending' },
      { label: 'Recursos', detail: definitive ? 'janela encerrada/definitivo' : preliminary ? 'conferir itens recorríveis' : 'após correção', state: definitive ? 'done' : preliminary ? 'current' : 'pending' },
      { label: 'Resultado', detail: anyRanking ? 'classificação registrada' : definitive ? 'acompanhar classificação' : 'etapa futura', state: anyRanking ? 'done' : definitive ? 'current' : 'pending' },
    ];
  }

  function transitionConsole(data = snapshot) {
    const age = snapshotAge(data);
    const stages = stageModel(data);
    return `
      <section class="panel v28-transition-console" data-v28-transition-console>
        <div class="v28-console-head">
          <div><span class="eyebrow">CENTRAL ADAPTATIVA · PÓS-PROVA</span><h2>SEDES em acompanhamento. A transição já pode olhar para frente.</h2><p>O ciclo não volta ao zero: a SEDES segue no trilho de gabarito, recursos e resultado, enquanto as próximas frentes entram como decisões estratégicas separadas.</p></div>
          <span class="v28-live-chip"><i></i> snapshot ${esc(age.label)}</span>
        </div>
        <div class="v28-flow" aria-label="Fluxo pós-prova SEDES/DF">
          ${stages.map(stage => `<article class="v28-flow-step ${stage.state}"><span>${stage.state === 'done' ? 'concluído' : stage.state === 'current' ? 'agora' : 'depois'}</span><strong>${esc(stage.label)}</strong><small>${esc(stage.detail)}</small></article>`).join('')}
        </div>
        <div class="v28-next-lanes">
          <article class="v28-lane-intro"><span>PRÓXIMA TRANSIÇÃO</span><strong>Não misturar acompanhamento da SEDES com a nova preparação.</strong><p>O histórico permanece como capital acumulado; cada projeto novo ganha metas, questões e erros próprios.</p></article>
          <button class="v28-lane" type="button" data-view="strategy"><span>TRILHA 01</span><strong>SEEDF</strong><small>administrativo · gestão educacional · curto prazo</small></button>
          <button class="v28-lane" type="button" data-view="strategy"><span>TRILHA 02</span><strong>TJDFT</strong><small>estrutura de tribunais · construção de longo prazo</small></button>
        </div>
      </section>`;
  }

  function patchHome(data = snapshot) {
    const root = document.querySelector('.command-view');
    if (!root || data?.meta?.phase !== 'post-exam') return;
    ensureStyles();

    const signature = JSON.stringify({
      generatedAt: data?.meta?.generatedAt || null,
      stages: stageModel(data).map(({ label, detail, state }) => [label, detail, state]),
    });
    let consoleNode = root.querySelector('[data-v28-transition-console]');
    if (!consoleNode) {
      const commandGrid = root.querySelector('.command-grid');
      if (commandGrid) commandGrid.insertAdjacentHTML('afterend', transitionConsole(data));
      else root.insertAdjacentHTML('afterbegin', transitionConsole(data));
      consoleNode = root.querySelector('[data-v28-transition-console]');
      if (consoleNode) consoleNode.dataset.v28Signature = signature;
    } else if (consoleNode.dataset.v28Signature !== signature) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = transitionConsole(data).trim();
      const replacement = wrapper.firstElementChild;
      if (replacement) {
        replacement.dataset.v28Signature = signature;
        consoleNode.replaceWith(replacement);
      }
    }

    const action = root.querySelector('.v27-next-action');
    const paragraph = action?.querySelector('p');
    const desired = 'A SEDES agora roda como processo em acompanhamento: gabarito → conferência → recursos → nota → classificação. A nova preparação fica em trilhas próprias.';
    if (paragraph && paragraph.textContent.trim() !== desired) paragraph.innerHTML = 'A SEDES agora roda como <strong>processo em acompanhamento</strong>: gabarito → conferência → recursos → nota → classificação. A nova preparação fica em trilhas próprias.';
  }

  function patchRefreshSemantics(data = snapshot) {
    if (!data) return;
    const age = snapshotAge(data);
    const refreshing = [...document.querySelectorAll('[data-refresh]')].some(button => button.classList.contains('spinning') || button.getAttribute('aria-busy') === 'true');
    const refreshLabel = document.getElementById('refreshLabel');
    setText(refreshLabel, refreshing ? 'Recarregando…' : 'Recarregar snapshot');
    const refreshAge = document.getElementById('refreshAge');
    setText(refreshAge, `${age.label} · publicado`);

    const toast = document.getElementById('toast');
    if (toast?.classList.contains('show') && toast.textContent.trim() === 'Dados publicados atualizados agora.') {
      setText(toast, 'Snapshot publicado recarregado.');
    }

    document.querySelectorAll('[data-refresh]').forEach(button => {
      if (button.getAttribute('title') !== 'Recarrega do GitHub Pages o snapshot mais recente já publicado. Não dispara o Notion diretamente.') button.setAttribute('title', 'Recarrega do GitHub Pages o snapshot mais recente já publicado. Não dispara o Notion diretamente.');
      if (button.getAttribute('aria-label') !== 'Recarregar snapshot publicado') button.setAttribute('aria-label', 'Recarregar snapshot publicado');
      const textNode = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (textNode && button.id === 'moreRefreshBtn' && textNode.textContent.trim() !== 'Recarregar snapshot') textNode.textContent = ' Recarregar snapshot';
    });

    const sheetActions = document.querySelector('.sheet-actions');
    if (sheetActions && !sheetActions.querySelector('[data-v28-sync-workflow]')) {
      const link = document.createElement('a');
      link.className = 'action-button v28-source-sync';
      link.dataset.v28SyncWorkflow = '1';
      link.href = SYNC_WORKFLOW_URL;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Sincronizar fonte';
      link.title = 'Abre o workflow seguro do GitHub Actions para executar a sincronização Notion → snapshot.';
      sheetActions.prepend(link);
    }

    const syncCardActions = document.querySelector('.sync-command-card .command-actions');
    if (syncCardActions && !syncCardActions.querySelector('[data-v28-sync-workflow]')) {
      const link = document.createElement('a');
      link.className = 'secondary-button v28-source-sync';
      link.dataset.v28SyncWorkflow = '1';
      link.href = SYNC_WORKFLOW_URL;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Sincronizar Notion';
      link.title = 'Executar manualmente a sincronização segura no GitHub Actions.';
      syncCardActions.appendChild(link);
    }

    const syncCard = document.querySelector('.sync-command-card');
    if (syncCard && !syncCard.querySelector('[data-v28-sync-note]')) {
      const note = document.createElement('p');
      note.className = 'v28-sync-note';
      note.dataset.v28SyncNote = '1';
      note.textContent = 'Recarregar snapshot busca o arquivo já publicado. Sincronizar Notion abre a execução segura da fonte, sem expor credenciais no navegador.';
      syncCard.appendChild(note);
    }
  }

  function patch(data = snapshot) {
    if (data) snapshot = data;
    patchScoreCard('edas', snapshot);
    patchScoreCard('tdas', snapshot);
    patchHome(snapshot);
    patchRefreshSemantics(snapshot);
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
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    load();
    window.setInterval(() => patchRefreshSemantics(snapshot), 60000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();