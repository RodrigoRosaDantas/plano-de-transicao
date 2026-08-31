(() => {
  'use strict';

  const STUDY_BASE = '../sedes-df-questoes/';
  const ROUTES = {
    home: `${STUDY_BASE}#/inicio`,
    study: `${STUDY_BASE}#/estudar`,
    role: `${STUDY_BASE}estudo-por-cargo.html`,
    review: `${STUDY_BASE}#/revisar`,
    performance: `${STUDY_BASE}#/desempenho`,
    realExam: `${STUDY_BASE}#/inicio`
  };
  const ACTIVE_PROFILE_KEY = 'sedes.questoes.activeProfile.v3';
  const PROFILES_KEY = 'sedes.questoes.profiles.v3';
  const ui = {
    financeCycle: localStorage.getItem('plano.finance.cycle') || 'Todos',
    financeStatus: localStorage.getItem('plano.finance.status') || 'Todos',
    examFilter: localStorage.getItem('plano.exam.filter') || 'Todos',
    viewMode: localStorage.getItem('plano.view.mode') || 'resumo'
  };

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => new Intl.NumberFormat('pt-BR').format(Number(n || 0));
  const pct = n => `${Number(n || 0).toFixed(1).replace('.', ',')}%`;
  const money = n => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number(n || 0));
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };

  function activeProfile() {
    const profiles = readJSON(PROFILES_KEY, []);
    const id = localStorage.getItem(ACTIVE_PROFILE_KEY) || 'rodrigo';
    return profiles.find(p => p.id === id) || {id, name: id === 'rodrigo' ? 'Rodrigo' : id};
  }

  function profileKey(suffix) {
    return `sedes.questoes.${activeProfile().id}.${suffix}.v3`;
  }

  function studyState() {
    const profile = activeProfile();
    const history = readJSON(profileKey('history'), []);
    const errorsObj = readJSON(profileKey('errors'), {});
    const markedObj = readJSON(profileKey('marked'), {});
    const session = readJSON(profileKey('session'), null);
    const errors = Object.values(errorsObj || {}).filter(item => item && item.open !== false);
    const marked = Object.values(markedObj || {});
    let answered = 0, correct = 0, elapsed = 0;
    for (const attempt of history) {
      const results = Array.isArray(attempt?.questionResults) ? attempt.questionResults : [];
      const a = Number(attempt?.answered ?? results.filter(r => r?.answer).length ?? 0);
      const c = Number(attempt?.correct ?? results.filter(r => r?.correct).length ?? 0);
      answered += a;
      correct += c;
      elapsed += Number(attempt?.elapsed || 0);
    }
    const accuracy = answered ? correct / answered * 100 : 0;
    const current = Number(session?.current ?? 0);
    const sessionQuestions = Array.isArray(session?.questions) ? session.questions.length : Number(session?.questionCount || 0);
    return {
      profile,
      history,
      errors,
      marked,
      session,
      answered,
      correct,
      accuracy,
      elapsed,
      hasSession: Boolean(session && (sessionQuestions || session?.materialId || session?.answers)),
      sessionPosition: sessionQuestions ? `${Math.min(current + 1, sessionQuestions)}/${sessionQuestions}` : 'salva',
      lastAttempt: history[0] || null
    };
  }

  function updateLocalStatus() {
    const state = studyState();
    const el = $('#studyLocalStatus');
    if (!el) return;
    if (state.hasSession) el.textContent = `tentativa salva · ${state.sessionPosition}`;
    else if (state.history.length) el.textContent = `${fmt(state.history.length)} tentativas locais · ${pct(state.accuracy)}`;
    else el.textContent = 'progresso local pronto';
  }

  function studyAction(href, icon, title, text, badge = '') {
    return `<a class="work-action-card" href="${href}"><span class="work-action-icon">${icon}</span><div><div class="work-action-head"><strong>${esc(title)}</strong>${badge ? `<em>${esc(badge)}</em>` : ''}</div><small>${esc(text)}</small></div><b>›</b></a>`;
  }

  function toolsMarkup() {
    const state = studyState();
    const sessionTitle = state.hasSession ? 'Retomar tentativa' : 'Começar estudo';
    const sessionText = state.hasSession ? `Sessão preservada na posição ${state.sessionPosition}.` : 'Monte uma bateria por matéria, assunto, cargo e quantidade.';
    return `<section class="work-page-heading"><div><p class="eyebrow">FERRAMENTAS DE ESTUDO</p><h1>Estudo e transição no mesmo ecossistema.</h1><p>As ferramentas abaixo usam a Plataforma de Questões já madura. O progresso existente continua no mesmo armazenamento e, quando configurado, na mesma sincronização entre aparelhos.</p></div><a class="btn-work primary" href="${ROUTES.home}">Abrir plataforma completa ↗</a></section>
      <section class="work-study-hero panel"><div><p class="eyebrow">PERFIL ATIVO</p><h2>${esc(state.profile.name)}</h2><p>${state.hasSession ? 'Há uma tentativa em andamento pronta para continuar.' : 'Nenhuma tentativa em andamento. Seu histórico permanece preservado.'}</p><div class="work-hero-actions"><a class="btn-work primary" href="${state.hasSession ? ROUTES.home : ROUTES.study}">${state.hasSession ? 'Continuar de onde parou' : 'Estudar agora'}</a><a class="btn-work" href="${ROUTES.review}">Abrir revisões</a></div></div><div class="work-profile-orb"><span>${esc((state.profile.name || 'R')[0].toUpperCase())}</span><small>${state.hasSession ? state.sessionPosition : 'perfil local'}</small></div></section>
      <section class="work-metrics-grid">
        <article class="work-metric card"><small>Tentativas</small><strong>${fmt(state.history.length)}</strong><span>histórico local preservado</span></article>
        <article class="work-metric card"><small>Questões respondidas</small><strong>${fmt(state.answered)}</strong><span>${fmt(state.correct)} acertos</span></article>
        <article class="work-metric card"><small>Aproveitamento local</small><strong>${pct(state.accuracy)}</strong><span>com base nas tentativas salvas</span></article>
        <article class="work-metric card"><small>Revisão aberta</small><strong>${fmt(state.errors.length)}</strong><span>${fmt(state.marked.length)} questões marcadas</span></article>
      </section>
      <section class="work-actions-grid">
        ${studyAction(state.hasSession ? ROUTES.home : ROUTES.study, '▶', sessionTitle, sessionText, state.hasSession ? 'salva' : '')}
        ${studyAction(ROUTES.study, '▣', 'Banco de questões', 'Treino por matéria, assunto, cargo, quantidade e modo de prova.')}
        ${studyAction(ROUTES.role, '▦', 'Estudo por cargo', 'Navegue pelo conteúdo verticalizado para TDAS e EDAS.')}
        ${studyAction(ROUTES.review, '◎', 'Revisões e caderno de erros', `${fmt(state.errors.length)} erros abertos e ${fmt(state.marked.length)} marcadas no perfil ativo.`)}
        ${studyAction(ROUTES.performance, '◔', 'Desempenho por matéria', 'Histórico, cobertura, matérias, assuntos fracos, backup e dados do perfil.')}
        ${studyAction(ROUTES.realExam, '◇', 'Prova Real SEDES/DF', 'Simulação de 60 questões com pesos, relógio e matriz do edital.')}
      </section>
      <section class="panel work-capability-panel"><div class="panel-head"><div><p class="eyebrow">PARIDADE FUNCIONAL</p><h2>Ferramentas preservadas</h2></div><span class="work-health">● ecossistema conectado</span></div><div class="work-capability-grid">${['Modo treino e prova','Cronômetro total e por questão','Autosave e retomada','Caderno de erros','Questões marcadas','Revisão D0/D7/D20','Revisão adaptativa','Desempenho por matéria e assunto','Prova Real','Backup de progresso','PWA / uso offline','Sincronização opcional entre aparelhos'].map(x=>`<span>✓ ${esc(x)}</span>`).join('')}</div></section>`;
  }

  function setToolsActive() {
    $$('[data-view]').forEach(b => b.classList.remove('active'));
    $$('[data-tool-view="tools"]').forEach(b => b.classList.add('active'));
    const ctx = $('#pageContext'); if (ctx) ctx.textContent = 'Estudar';
  }

  function renderTools() {
    if (typeof DATA === 'undefined' || !DATA) return setTimeout(renderTools, 80);
    history.replaceState(null, '', '#tools');
    const content = $('#content');
    if (!content) return;
    content.innerHTML = toolsMarkup();
    setToolsActive();
    updateLocalStatus();
    window.scrollTo({top: 0, behavior: 'instant'});
    document.querySelector('#sidebar')?.classList.remove('open');
    document.querySelector('#sidebarBackdrop')?.classList.remove('show');
  }

  function commandCenterMarkup() {
    const state = studyState();
    const actionHref = state.hasSession ? ROUTES.home : ROUTES.study;
    return `<section class="work-command-center">
      <div class="work-command-head"><div><p class="eyebrow">COMANDO DE ESTUDO</p><h2>${state.hasSession ? 'Você tem uma sessão pronta para continuar.' : 'O que você quer fazer agora?'}</h2><p>${state.hasSession ? `Tentativa preservada na posição ${state.sessionPosition}; sair do Plano não apaga seu progresso.` : 'As ações abaixo abrem os módulos maduros da Plataforma de Questões sem criar um segundo histórico.'}</p></div><a class="btn-work primary" href="${actionHref}">${state.hasSession ? 'Retomar tentativa' : 'Estudar agora'} →</a></div>
      <div class="work-quick-grid">
        ${studyAction(ROUTES.study, '▣', 'Treinar', 'Matéria, assunto, cargo e quantidade')}
        ${studyAction(ROUTES.review, '◎', 'Revisar', `${fmt(state.errors.length)} erros · ${fmt(state.marked.length)} marcadas`)}
        ${studyAction(ROUTES.performance, '◔', 'Desempenho', state.answered ? `${fmt(state.answered)} respondidas · ${pct(state.accuracy)}` : 'Acompanhar matérias e assuntos')}
        ${studyAction(ROUTES.realExam, '◇', 'Prova Real', '60 questões · padrão SEDES/DF')}
      </div>
    </section>`;
  }

  function injectHomeTools() {
    if (location.hash && location.hash !== '#home') return;
    const content = $('#content');
    if (!content || content.querySelector('.work-command-center')) return;
    const title = content.querySelector('.section-title');
    if (!title) return;
    title.insertAdjacentHTML('afterend', commandCenterMarkup());
    updateLocalStatus();
  }

  function chartMarkup() {
    if (typeof DATA === 'undefined' || !DATA?.historyCycles?.length) return '';
    const cycles = [...DATA.historyCycles].filter(x => Number.isFinite(Number(x.accuracy)));
    if (cycles.length < 2) return '';
    const ordered = cycles.some(x => x.date) ? cycles.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))) : cycles;
    const w = 820, h = 220, pad = 28;
    const values = ordered.map(x => Number(x.accuracy));
    const min = Math.max(0, Math.floor(Math.min(...values) - 5));
    const max = Math.min(100, Math.ceil(Math.max(...values) + 3));
    const range = Math.max(1, max - min);
    const pts = ordered.map((x,i) => {
      const px = pad + (w - pad*2) * (ordered.length === 1 ? .5 : i/(ordered.length-1));
      const py = h - pad - (Number(x.accuracy)-min)/range*(h-pad*2);
      return {x:px,y:py,item:x};
    });
    const path = pts.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return `<section class="panel work-chart-panel"><div class="panel-head"><div><p class="eyebrow">EVOLUÇÃO / COMPARATIVO</p><h2>Aproveitamento nos ciclos</h2></div><span class="chart-scale">${min}%–${max}%</span></div><div class="work-line-chart"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de aproveitamento por ciclo"><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="chart-axis"/><path d="${path}" class="chart-line" fill="none"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="5" class="chart-point"><title>${esc(p.item.name)}: ${pct(p.item.accuracy)}</title></circle>`).join('')}</svg></div><div class="chart-legend">${ordered.map((x,i)=>`<span><b>${i+1}</b>${esc(x.name)} · ${pct(x.accuracy)}</span>`).join('')}</div></section>`;
  }

  function injectPerformanceChart() {
    if (location.hash !== '#performance') return;
    const content = $('#content');
    if (!content || content.querySelector('.work-chart-panel')) return;
    const split = content.querySelector('.performance-split');
    if (!split) return;
    split.insertAdjacentHTML('beforebegin', chartMarkup());
  }

  function examExtra(exam) {
    const items = [
      ['Etapa', exam.classificationStage],
      ['Classificados', exam.stageClassified ? fmt(exam.stageClassified) : null],
      ['Empatados na nota', exam.sameScoreCandidates ? fmt(exam.sameScoreCandidates) : null],
      ['Concorrência/vaga', exam.competitionPerVacancy ? String(exam.competitionPerVacancy).replace('.', ',') : null],
      ['Universo', exam.competitionUniverse],
      ['Inscrições', exam.registrations ? fmt(exam.registrations) : null],
      ['Vagas imediatas', exam.immediateVacancies ? fmt(exam.immediateVacancies) : null],
      ['Vagas AC', exam.immediateVacanciesAC ? fmt(exam.immediateVacanciesAC) : null],
      ['CR AC', exam.reservePositionsAC ? fmt(exam.reservePositionsAC) : null],
      ['Status financeiro', exam.financialStatus]
    ].filter(([,v]) => v != null && v !== '');
    if (!items.length) return '';
    return `<div class="work-exam-extra">${items.map(([k,v])=>`<div><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('')}</div>`;
  }

  function injectExamTools() {
    if (location.hash !== '#exams' || typeof DATA === 'undefined' || !DATA?.exams) return;
    const content = $('#content');
    if (!content || content.querySelector('.work-exam-toolbar')) return;
    const title = content.querySelector('.section-title');
    const names = DATA.exams.map(e => e.name);
    title?.insertAdjacentHTML('afterend', `<div class="work-exam-toolbar panel"><label><span>Concurso</span><select id="workExamFilter"><option>Todos</option>${names.map(n=>`<option ${ui.examFilter===n?'selected':''}>${esc(n)}</option>`).join('')}</select></label><div class="work-view-toggle"><button data-mode="resumo" class="${ui.viewMode==='resumo'?'active':''}">Resumo</button><button data-mode="auditoria" class="${ui.viewMode==='auditoria'?'active':''}">Auditoria</button></div></div>`);
    $$('.exam-card').forEach((card,i)=>{
      const exam = DATA.exams[i];
      if (!exam) return;
      card.dataset.examName = exam.name;
      const rank = card.querySelector('.exam-rank');
      rank?.insertAdjacentHTML('afterend', examExtra(exam));
    });
    const apply = () => {
      $$('.exam-card').forEach(card => card.hidden = ui.examFilter !== 'Todos' && card.dataset.examName !== ui.examFilter);
      $$('.exam-card details').forEach(d => d.open = ui.viewMode === 'auditoria');
      $$('.work-exam-extra').forEach(x => x.style.display = ui.viewMode === 'auditoria' ? 'grid' : 'none');
    };
    $('#workExamFilter')?.addEventListener('change', e=>{ui.examFilter=e.target.value;localStorage.setItem('plano.exam.filter',ui.examFilter);apply();});
    $$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{ui.viewMode=b.dataset.mode;localStorage.setItem('plano.view.mode',ui.viewMode);$$('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));apply();}));
    apply();
  }

  function financeChart(summary) {
    const rows = summary?.byCategory || [];
    const max = Math.max(1, ...rows.map(x => Number(x.confirmed || x.estimated || 0)));
    return `<div class="work-finance-bars">${rows.slice(0,10).map(x=>`<div class="work-finance-bar"><div><strong>${esc(x.key)}</strong><small>${money(x.confirmed)} confirmado${x.estimated ? ` · ${money(x.estimated)} estimado` : ''}</small></div><div class="bar-track"><span style="width:${Math.max(2,(Number(x.confirmed||0)/max*100)).toFixed(1)}%"></span></div></div>`).join('')}</div>`;
  }

  function financeRowsMarkup(entries) {
    return entries.length ? `<div class="work-ledger-list">${entries.map(x=>`<details class="work-ledger-row"><summary><div><strong>${esc(x.name || 'Lançamento')}</strong><small>${esc(x.cycle)} · ${esc(x.category)}</small></div><div class="ledger-value"><strong>${x.confirmed != null && x.confirmed !== 0 ? money(x.confirmed) : x.estimated != null && x.estimated !== 0 ? `~ ${money(x.estimated)}` : '—'}</strong><span class="pill ${x.situation.includes('Confirmado')?'good':x.situation==='Estimado'?'warn':''}">${esc(x.situation)}</span></div></summary><div class="ledger-detail"><span><b>Data</b>${x.date ? new Date(`${x.date}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informada'}</span><span><b>Uso</b>${esc(x.usage)}</span><span><b>Natureza</b>${esc(x.nature)}</span><span><b>Rateio</b>${x.allocationPercent == null ? '—' : `${x.allocationPercent}%`}</span><span><b>Conta no ciclo</b>${x.countsInCycle?'Sim':'Não'}</span><span><b>Comprovante</b>${x.sourceAvailable?'Registrado':'Não registrado'}</span></div></details>`).join('')}</div>` : '<div class="work-empty">Nenhum lançamento para estes filtros.</div>';
  }

  function injectFinanceTools() {
    if (location.hash !== '#finance' || typeof DATA === 'undefined' || !Array.isArray(DATA?.financeEntries) || !DATA.financeEntries.length) return;
    const content = $('#content');
    if (!content || content.querySelector('.work-finance-toolbox')) return;
    const title = content.querySelector('.section-title');
    const cycles = ['Todos', ...new Set(DATA.financeEntries.map(x=>x.cycle))];
    const statuses = ['Todos', ...new Set(DATA.financeEntries.map(x=>x.situation))];
    const html = `<section class="work-finance-toolbox"><div class="work-filterbar panel"><label><span>Concurso / ciclo</span><select id="workFinanceCycle">${cycles.map(x=>`<option ${ui.financeCycle===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label><span>Situação</span><select id="workFinanceStatus">${statuses.map(x=>`<option ${ui.financeStatus===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><div class="work-filter-result"><strong id="workFinanceCount">0</strong><span>lançamentos exibidos</span></div></div><div class="work-finance-layout"><section class="panel"><div class="panel-head"><div><p class="eyebrow">COMPOSIÇÃO DOS GASTOS</p><h2>Por categoria</h2></div></div>${financeChart(DATA.financeSummary)}</section><section class="panel"><div class="panel-head"><div><p class="eyebrow">LANÇAMENTOS INDIVIDUAIS</p><h2>Visão progressiva</h2></div></div><div id="workLedger"></div></section></div></section>`;
    title?.insertAdjacentHTML('afterend', html);
    const apply = () => {
      const filtered = DATA.financeEntries.filter(x => (ui.financeCycle==='Todos'||x.cycle===ui.financeCycle) && (ui.financeStatus==='Todos'||x.situation===ui.financeStatus));
      const ledger = $('#workLedger'); if (ledger) ledger.innerHTML = financeRowsMarkup(filtered);
      const count = $('#workFinanceCount'); if (count) count.textContent = fmt(filtered.length);
    };
    $('#workFinanceCycle')?.addEventListener('change',e=>{ui.financeCycle=e.target.value;localStorage.setItem('plano.finance.cycle',ui.financeCycle);apply();});
    $('#workFinanceStatus')?.addEventListener('change',e=>{ui.financeStatus=e.target.value;localStorage.setItem('plano.finance.status',ui.financeStatus);apply();});
    apply();
  }

  function enhanceCurrentView() {
    if (location.hash === '#tools') return;
    $$('[data-tool-view="tools"]').forEach(b => b.classList.remove('active'));
    injectHomeTools();
    injectPerformanceChart();
    injectExamTools();
    injectFinanceTools();
    updateLocalStatus();
  }

  function bind() {
    $$('[data-tool-view="tools"]').forEach(button => button.addEventListener('click', e => { e.preventDefault(); renderTools(); }));
    $$('[data-view]').forEach(button => button.addEventListener('click', () => setTimeout(enhanceCurrentView, 30)));
    window.addEventListener('storage', updateLocalStatus);
    const content = $('#content');
    if (content) new MutationObserver(() => requestAnimationFrame(enhanceCurrentView)).observe(content, {childList:true, subtree:false});
    if (location.hash === '#tools') renderTools(); else setTimeout(enhanceCurrentView, 120);
  }

  document.addEventListener('DOMContentLoaded', bind);
})();
