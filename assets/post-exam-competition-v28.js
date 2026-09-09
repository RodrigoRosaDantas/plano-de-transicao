(() => {
  let snapshot = window.__planoPublishedSnapshot || null;
  let queued = false;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const fmt = value => value == null ? '—' : new Intl.NumberFormat('pt-BR').format(Number(value));
  const pct = value => value == null ? '—' : `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const date = value => {
    if (!value) return '—';
    const parsed = new Date(`${value}T12:00:00-03:00`);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(parsed);
  };

  function reading(data = snapshot) {
    return data?.postExam?.competitionReading || null;
  }

  function ensureStyles() {
    if (document.getElementById('v28-competition-styles')) return;
    const style = document.createElement('style');
    style.id = 'v28-competition-styles';
    style.textContent = `
      .v28-competition-panel{display:grid;gap:16px;padding:22px!important;overflow:hidden}
      .v28-competition-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .v28-competition-head h3{margin:.25rem 0 .45rem;font-size:clamp(1.25rem,2.4vw,1.7rem)}
      .v28-competition-head p{margin:0;color:var(--text-muted,#969d99);max-width:76ch;line-height:1.55}
      .v28-prelim-chip{display:inline-flex;align-items:center;padding:7px 10px;border:1px solid color-mix(in srgb,#e8b35b 38%,var(--line,#29312e));border-radius:999px;color:#e8b35b;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
      .v28-competition-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .v28-competition-card{padding:17px;border:1px solid var(--line,#29312e);border-radius:18px;background:var(--surface-2,#111816);min-width:0}
      .v28-competition-card header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}
      .v28-competition-card header span{display:block;color:var(--text-muted,#8f9793);font-size:.7rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .v28-competition-card header strong{display:block;margin-top:4px;font-size:1.05rem}
      .v28-score-pill{font-size:1.35rem!important;line-height:1;font-weight:900!important;color:var(--accent,#b9ff59)!important;letter-spacing:-.03em!important;text-transform:none!important}
      .v28-competition-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .v28-competition-stat{padding:11px;border:1px solid color-mix(in srgb,var(--line,#29312e) 82%,transparent);border-radius:13px;background:color-mix(in srgb,var(--surface,#0d1210) 65%,transparent);min-width:0}
      .v28-competition-stat small,.v28-competition-stat span{display:block;color:var(--text-muted,#8f9793)}
      .v28-competition-stat small{font-size:.67rem;line-height:1.25}
      .v28-competition-stat strong{display:block;margin:4px 0 2px;font-size:1rem;overflow-wrap:anywhere}
      .v28-competition-stat span{font-size:.69rem;line-height:1.3}
      .v28-probability-lock{margin-top:10px;padding:11px 12px;border-radius:13px;border:1px dashed color-mix(in srgb,#64d8cf 35%,var(--line,#29312e));background:color-mix(in srgb,#64d8cf 4%,transparent)}
      .v28-probability-lock strong{display:block;font-size:.78rem;color:#64d8cf;margin-bottom:4px}
      .v28-probability-lock span{display:block;color:var(--text-muted,#8f9793);font-size:.75rem;line-height:1.45}
      .v28-competition-footer{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:10px}
      .v28-competition-note,.v28-milestones{padding:14px;border:1px solid var(--line,#29312e);border-radius:15px;background:color-mix(in srgb,var(--surface-2,#111816) 84%,transparent)}
      .v28-competition-note strong,.v28-milestones strong{display:block;margin-bottom:5px}
      .v28-competition-note p{margin:0;color:var(--text-muted,#8f9793);font-size:.78rem;line-height:1.5}
      .v28-milestones ul{margin:0;padding-left:17px;color:var(--text-muted,#8f9793);font-size:.76rem;line-height:1.55}
      .v28-competition-source{margin:0;color:var(--text-muted,#8f9793);font-size:.7rem;line-height:1.45}
      @media(max-width:900px){.v28-competition-grid,.v28-competition-footer{grid-template-columns:1fr}.v28-competition-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:620px){.v28-competition-panel{padding:18px!important}.v28-competition-head{display:block}.v28-prelim-chip{margin-top:10px}.v28-competition-stats{grid-template-columns:1fr}.v28-competition-card header{align-items:center}}
    `;
    document.head.appendChild(style);
  }

  function examCard(id, info) {
    if (!info) return '';
    const title = id === 'tdas' ? 'TDAS · Técnico Administrativo' : 'EDAS · Administração';
    const listed = Number(info.immediateVacanciesAC || 0) + Number(info.reservePositionsAC || 0);
    return `
      <article class="v28-competition-card" data-v28-competition-card="${id}">
        <header>
          <div><span>${esc(title)} · Tipo ${esc(info.examType || '—')}</span><strong>Referência de ampla concorrência (AC)</strong></div>
          <span class="v28-score-pill">${esc(info.preliminaryScore ?? '—')}/100</span>
        </header>
        <div class="v28-competition-stats">
          <div class="v28-competition-stat"><small>Mínimos objetivos</small><strong>${info.objectiveMinimumsMet ? 'Atingidos ✓' : 'A confirmar'}</strong><span>CG ${esc(info.preliminaryGeneralScore ?? '—')}/20 · CE ${esc(info.preliminarySpecificScore ?? '—')}/80</span></div>
          <div class="v28-competition-stat"><small>Taxa nominal de correção AC</small><strong>${pct(info.nominalCorrectionRateAC)}</strong><span>${fmt(info.correctionSlotsAC)} correções ÷ ${fmt(info.registrationsAC)} inscrições AC</span></div>
          <div class="v28-competition-stat"><small>Vagas + CR previstos na AC</small><strong>${fmt(listed)}</strong><span>${fmt(info.immediateVacanciesAC)} imediatas + ${fmt(info.reservePositionsAC)} CR</span></div>
        </div>
        <div class="v28-probability-lock"><strong>Chance pessoal: ainda não estimável com rigor</strong><span>Faltam distribuição oficial das notas, nota de corte e classificação objetiva. A taxa nominal acima descreve o concurso; não é sua probabilidade individual.</span></div>
      </article>`;
  }

  function panelTemplate(data = snapshot) {
    const info = reading(data);
    if (!info) return '';
    const tdas = info.exams?.tdas;
    const edas = info.exams?.edas;
    const milestones = info.milestones || {};
    return `
      <section class="panel v28-competition-panel" data-v28-competition-panel>
        <div class="v28-competition-head">
          <div><span class="eyebrow">LEITURA COMPETITIVA · AUDITORIA PRELIMINAR</span><h3>Nota estimada é dado. “Chance de aprovação” ainda não.</h3><p>O painel separa o que já é verificável no edital do que depende da distribuição real das notas. Assim, 3,49% ou 6,86% não viram falsa “chance pessoal”.</p></div>
          <span class="v28-prelim-chip">preliminar · ${esc(date(info.auditedAt))}</span>
        </div>
        <div class="v28-competition-grid">${examCard('tdas', tdas)}${examCard('edas', edas)}</div>
        <div class="v28-competition-footer">
          <div class="v28-competition-note"><strong>Como interpretar</strong><p>${esc(info.rules?.interpretation || 'Aprovação/classificação, vagas/CR e nomeação são réguas distintas.')} Para ter a discursiva corrigida, é preciso superar os mínimos e ficar dentro do quantitativo classificatório da objetiva. Na discursiva, o mínimo editalício é 50/100.</p></div>
          <div class="v28-milestones"><strong>Próximos marcos prováveis</strong><ul><li>${esc(date(milestones.objectivePreliminaryResult))} · resultado preliminar da objetiva</li><li>${esc(date(milestones.objectiveDefinitiveAndDiscursiveCorrectionList))} · objetiva definitiva + relação para correção da discursiva</li><li>${esc(date(milestones.discursivePreliminaryResult))} · resultado preliminar da discursiva</li><li>${esc(date(milestones.discursiveDefinitiveResult))} · resultado definitivo da discursiva</li></ul></div>
        </div>
        <p class="v28-competition-source">Fonte: edital atualizado e quantitativos oficiais de inscrições homologadas. Referência AC usada apenas como taxa nominal do certame; modalidades reservadas têm quantitativos próprios e podem alterar a dinâmica da ampla concorrência conforme o edital.</p>
      </section>`;
  }

  function mountHome(data = snapshot) {
    const root = document.querySelector('.command-view');
    if (!root || !reading(data)) return;
    const current = root.querySelector('[data-v28-competition-panel]');
    const signature = JSON.stringify({ generatedAt: data?.meta?.generatedAt || null, reading: reading(data) });
    if (current?.dataset.signature === signature) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = panelTemplate(data).trim();
    const panel = wrapper.firstElementChild;
    if (!panel) return;
    panel.dataset.signature = signature;
    if (current) current.replaceWith(panel);
    else {
      const transition = root.querySelector('[data-v28-transition-console]');
      if (transition) transition.insertAdjacentElement('afterend', panel);
      else root.prepend(panel);
    }
  }

  function mountPostExam(data = snapshot) {
    const root = document.querySelector('[data-post-exam-v27]');
    if (!root || !reading(data)) return;
    const existing = root.querySelector('[data-v28-competition-panel]');
    const signature = JSON.stringify({ generatedAt: data?.meta?.generatedAt || null, reading: reading(data) });
    if (existing?.dataset.signature === signature) return;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = panelTemplate(data).trim();
    const panel = wrapper.firstElementChild;
    if (!panel) return;
    panel.dataset.signature = signature;
    if (existing) existing.replaceWith(panel);
    else {
      const grid = root.querySelector('.v27-exam-grid');
      if (grid) grid.insertAdjacentElement('afterend', panel);
      else root.appendChild(panel);
    }
  }

  function patch(data = snapshot) {
    if (data) snapshot = data;
    if (!reading(snapshot)) return;
    ensureStyles();
    mountHome(snapshot);
    mountPostExam(snapshot);
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
      const response = await fetch(`data/snapshot.json?v28competition=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) snapshot = await response.json();
    } catch {}
    schedule(snapshot);
  }

  window.addEventListener('plano:snapshot-loaded', event => schedule(event.detail || snapshot));
  window.addEventListener('hashchange', () => window.setTimeout(() => schedule(), 0));
  document.addEventListener('click', event => {
    if (event.target.closest('[data-refresh]') || event.target.closest('[data-exam-day-tab]')) window.setTimeout(load, 650);
  });

  const start = () => {
    const content = document.getElementById('content');
    if (content) new MutationObserver(() => schedule()).observe(content, { childList: true, subtree: true });
    load();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();