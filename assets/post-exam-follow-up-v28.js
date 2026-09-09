
(() => {
  let snapshot = window.__planoPublishedSnapshot || null;
  let queued = false;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const pct = (value, max) => max > 0 ? Math.max(0, Math.min(100, Math.round((number(value) / number(max)) * 1000) / 10)) : 0;

  const fmt = (value) => number(value).toLocaleString('pt-BR');
  const fmtPct = (value) => value == null ? '—' : number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  const fmtDate = (value) => {
    if (!value) return '—';
    const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? match[3] + '/' + match[2] + '/' + match[1] : String(value);
  };
  const fmtDateRange = (start, end) => start && end ? fmtDate(start) + ' a ' + fmtDate(end) : fmtDate(start || end);

  const statusLabel = (status) => ({
    done: 'Concluído',
    current: 'Agora',
    upcoming: 'Programado',
    pending: 'Aguardando'
  }[status] || 'Em acompanhamento');

  const statusClass = (status) => String(status || 'pending').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  const followUp = (data) => data?.postExam?.followUp || null;
  const readiness = (data) => data?.preExamReadiness || null;

  const followUpSignature = (data) => {
    const fu = followUp(data);
    return JSON.stringify({
      version: fu?.version,
      lastCalculatedAt: fu?.lastCalculatedAt,
      tdas: fu?.exams?.tdas?.result?.totalScore,
      edas: fu?.exams?.edas?.result?.totalScore,
      differences: number(fu?.resources?.totalDifferenceCount)
    });
  };

  function link(href, label) {
    return href
      ? '<a class="v28-followup-link" href="' + esc(href) + '" target="_blank" rel="noreferrer">' + esc(label) + ' ↗</a>'
      : '';
  }

  function examTitle(id, exam) {
    return (id === 'tdas' ? 'TDAS 202' : 'EDAS 400') + ' · Tipo ' + esc(exam?.examType || '—');
  }

  function scoreRow(id, exam) {
    const result = exam?.result || {};
    const total = number(result.totalScore);
    const max = number(result.maxScore, 100);
    const width = pct(total, max);
    return '<div class="v28-followup-score-row">' +
      '<div class="v28-followup-row-head"><strong>' + examTitle(id, exam) + '</strong><b>' + esc(total) + '/' + esc(max) + '</b></div>' +
      '<div class="v28-followup-track"><span style="width:' + width + '%"></span></div>' +
      '<small>' + esc(exam?.role || '') + ' · ' + esc(exam?.status === 'definitive' ? 'definitiva' : 'preliminar') + ' · CG ' + esc(result.generalScore ?? '—') + '/20 · CE ' + esc(result.specificScore ?? '—') + '/80</small>' +
      '</div>';
  }

  function compositionRow(id, exam) {
    const candidate = exam?.candidate || {};
    const result = exam?.result || {};
    const total = Math.max(1, number(candidate.registeredQuestions, 60));
    const correct = number(result.correct);
    const wrong = number(result.wrong);
    const invalid = number(result.invalid) + number(result.annulled);
    const candidateAccuracy = candidate.rawAccuracy;
    return '<div class="v28-followup-composition-row">' +
      '<div class="v28-followup-row-head"><strong>' + examTitle(id, exam) + '</strong><span>' + fmtPct(candidateAccuracy) + ' bruto anotado</span></div>' +
      '<div class="v28-followup-stack" role="img" aria-label="' + esc(correct + ' acertos, ' + wrong + ' erros e ' + invalid + ' inválidas ou anuladas') + '">' +
        '<span class="is-correct" style="width:' + pct(correct, total) + '%"></span>' +
        '<span class="is-wrong" style="width:' + pct(wrong, total) + '%"></span>' +
        '<span class="is-invalid" style="width:' + pct(invalid, total) + '%"></span>' +
      '</div>' +
      '<div class="v28-followup-legend"><span><i class="is-correct"></i>' + fmt(correct) + ' acertos</span><span><i class="is-wrong"></i>' + fmt(wrong) + ' erros</span><span><i class="is-invalid"></i>' + fmt(invalid) + ' inválida/anulada</span></div>' +
      '</div>';
  }

  function areaRows(id, exam) {
    const areas = exam?.areas || [];
    if (!areas.length) return '<p class="v28-followup-empty">Blocos aguardando correção oficial.</p>';
    return '<div class="v28-followup-area-exam"><div class="v28-followup-row-head"><strong>' + examTitle(id, exam) + '</strong><span>pontuação por bloco</span></div>' +
      areas.map((area) => {
        const width = pct(area.score, area.maxScore);
        return '<div class="v28-followup-area-row"><div><span>' + esc(area.label) + '</span><b>' + esc(area.score) + '/' + esc(area.maxScore) + '</b></div><div class="v28-followup-track is-thin"><span style="width:' + width + '%"></span></div><small>' + fmt(area.correct) + ' acertos · ' + fmtPct(area.accuracy) + ' de questões</small></div>';
      }).join('') + '</div>';
  }

  function milestoneRows(fu) {
    return (fu?.milestones || []).map((item) => {
      const dateText = item.start && item.end ? fmtDateRange(item.start, item.end) : fmtDate(item.date);
      return '<div class="v28-followup-milestone v28-followup-milestone--' + statusClass(item.status) + '">' +
        '<span class="v28-followup-milestone-dot"></span><div><div class="v28-followup-row-head"><strong>' + esc(item.label) + '</strong><b>' + esc(statusLabel(item.status)) + '</b></div>' +
        '<small>' + esc(dateText) + (item.detail ? ' · ' + esc(item.detail) : '') + '</small></div></div>';
    }).join('');
  }

  function resourceRows(fu) {
    return Object.entries(fu?.exams || {}).map(([id, exam]) => {
      const resources = exam.resources || {};
      const result = exam.result || {};
      return '<article class="v28-followup-resource"><div class="v28-followup-row-head"><strong>' + examTitle(id, exam) + '</strong><b>' + fmt(resources.differenceCount) + ' divergência(s)</b></div>' +
        '<p>' + esc(exam.role || '') + '</p><div class="v28-followup-resource-metrics"><span><b>' + fmt(resources.potentialGainIfAllResolved) + '</b> pontos no cenário máximo</span><span><b>' + fmt(result.objectiveMinimumsMet ? 1 : 0) + '</b> mínimo objetivo atingido</span></div>' +
        '<small>' + esc(resources.conclusion || 'Pré-análise aguardando gabarito e justificativas.') + '</small></article>';
    }).join('');
  }

  function readinessMarkup(data) {
    const model = readiness(data);
    if (!model) return '';
    const items = (model.checklist || []).map((item, index) => '<li><span>' + String(index + 1).padStart(2, '0') + '</span><div><strong>' + esc(item.title) + '</strong><small>' + esc(item.detail) + '</small></div></li>').join('');
    return '<section class="v28-preexam-ready" data-v28-preexam-ready><div class="v28-followup-section-head"><div><span class="eyebrow">PRÉ-PROVA · MODO DE ESPERA</span><h3>' + esc(model.title) + '</h3><p>' + esc(model.description) + '</p></div><span class="v28-followup-status v28-followup-status--standby">Pronto para ativar</span></div>' +
      '<div class="v28-preexam-grid"><div><p class="v28-followup-note"><b>Gatilho:</b> ' + esc(model.activationRule) + '</p><ul class="v28-preexam-checklist">' + items + '</ul></div><div class="v28-preexam-output"><span>O próximo projeto receberá</span>' + (model.outputs || []).map((item) => '<b>' + esc(item) + '</b>').join('') + '</div></div></section>';
  }

  function followUpMarkup(data) {
    const fu = followUp(data);
    if (!fu) return '';
    const examEntries = Object.entries(fu.exams || {});
    const totalDiff = number(fu.resources?.totalDifferenceCount);
    const potential = number(fu.resources?.totalPotentialGainIfAllResolved);
    const sourceDocs = fu.sourceDocuments || {};
    const signature = followUpSignature(data);
    return '<section class="panel v28-post-followup" data-v28-post-followup data-v28-followup-signature="' + esc(signature) + '">' +
      '<div class="v28-followup-header"><div><span class="eyebrow">ACOMPANHAMENTO PÓS-PROVA</span><h2>' + esc(fu.title) + '</h2><p>' + esc(fu.description) + '</p></div><span class="v28-followup-status v28-followup-status--active">' + esc(fu.currentStage || 'Em acompanhamento') + '</span></div>' +
      '<div class="v28-followup-kpis"><article><span>Próxima ação</span><strong>' + esc(fu.nextAction || 'Acompanhar atualização') + '</strong></article><article><span>Divergências para revisar</span><strong>' + fmt(totalDiff) + '</strong><small>somando os dois cargos</small></article><article><span>Ganho potencial máximo</span><strong>+' + fmt(potential) + ' pontos</strong><small>não é previsão de deferimento</small></article></div>' +
      '<div class="v28-followup-chart-grid"><article class="v28-followup-chart"><div class="v28-followup-section-head"><div><span class="eyebrow">VISÃO COMPARATIVA</span><h3>Nota ponderada</h3></div><small>CG + CE · máximo 100</small></div>' + examEntries.map(([id, exam]) => scoreRow(id, exam)).join('') + '</article>' +
      '<article class="v28-followup-chart"><div class="v28-followup-section-head"><div><span class="eyebrow">COMPOSIÇÃO</span><h3>As 60 respostas</h3></div><small>acerto · erro · inválida</small></div>' + examEntries.map(([id, exam]) => compositionRow(id, exam)).join('') + '</article>' +
      '<article class="v28-followup-chart v28-followup-chart--areas"><div class="v28-followup-section-head"><div><span class="eyebrow">DIAGNÓSTICO</span><h3>Pontuação por bloco</h3></div><small>respeita Tipo A/B</small></div>' + examEntries.map(([id, exam]) => areaRows(id, exam)).join('') + '</article></div>' +
      '<section class="v28-followup-timeline"><div class="v28-followup-section-head"><div><span class="eyebrow">LINHA DO TEMPO OFICIAL</span><h3>O que já aconteceu e o que vem agora</h3></div><small>atualizado em ' + esc(fmtDate(fu.lastCalculatedAt)) + '</small></div><div class="v28-followup-milestones">' + milestoneRows(fu) + '</div></section>' +
      '<details class="v28-followup-disclosure"><summary>Recursos e divergências</summary><div class="v28-followup-resource-grid">' + resourceRows(fu) + '</div><p class="v28-followup-note">' + esc(fu.resources?.note || '') + '</p><p class="v28-followup-note"><b>Janela oficial:</b> ' + esc(fmtDateRange(fu.resourceProtocol?.start, fu.resourceProtocol?.end)) + '. Um recurso por questão, pelo sistema da Quadrix, sem anexos.</p></details>' +
      '<details class="v28-followup-disclosure"><summary>Fontes e governança do acompanhamento</summary><div class="v28-followup-links">' + link(sourceDocs.contest, 'Página do concurso') + link(sourceDocs.updatedNotice, 'Edital atualizado') + link(sourceDocs.keyPdf, 'Gabarito preliminar') + link(sourceDocs.justificationsPdf, 'Justificativas') + link(sourceDocs.resourceNoticePdf, 'Comunicado de recursos') + '</div><p class="v28-followup-note">O painel é um snapshot publicado: respostas anotadas, gabarito preliminar, justificativas e resultado definitivo permanecem identificados como fontes diferentes.</p></details>' +
      readinessMarkup(data) +
      '</section>';
  }

  function standbyMarkup(data) {
    const model = readiness(data);
    if (!model) return '';
    return '<section class="panel v28-preexam-standby" data-v28-preexam-standby><div><span class="eyebrow">PRÓXIMA FASE · PRÉ-PROVA</span><h3>' + esc(model.title) + '</h3><p>' + esc(model.description) + '</p></div><span class="v28-followup-status v28-followup-status--standby">Estrutura preservada</span><div class="v28-standby-tags">' + (model.outputs || []).slice(0, 5).map((item) => '<span>' + esc(item) + '</span>').join('') + '</div></section>';
  }

  function ensureStyles() {
    if (document.getElementById('v28-followup-styles')) return;
    const style = document.createElement('style');
    style.id = 'v28-followup-styles';
    style.textContent = '.v28-post-followup{margin-top:16px;display:grid;gap:16px}.v28-followup-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:2px}.v28-followup-header h2{margin:4px 0 6px;font-size:clamp(1.35rem,2vw,1.9rem)}.v28-followup-header p{margin:0;max-width:780px;color:var(--text-muted,#9ba39f);line-height:1.5}.v28-followup-status{display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border-radius:999px;font-size:.72rem;font-weight:800;line-height:1.2;white-space:nowrap}.v28-followup-status--active{color:#b9ff59;background:color-mix(in srgb,#b9ff59 12%,transparent);border:1px solid color-mix(in srgb,#b9ff59 35%,var(--line,#29312e))}.v28-followup-status--standby{color:#64d8cf;background:color-mix(in srgb,#64d8cf 10%,transparent);border:1px solid color-mix(in srgb,#64d8cf 35%,var(--line,#29312e))}.v28-followup-kpis{display:grid;grid-template-columns:1.5fr repeat(2,minmax(0,1fr));gap:10px}.v28-followup-kpis article{padding:14px;border:1px solid var(--line,#29312e);border-radius:14px;background:var(--surface-2,#111816)}.v28-followup-kpis span,.v28-followup-chart small,.v28-followup-section-head>small,.v28-followup-resource>small{color:var(--text-muted,#8f9793);font-size:.72rem}.v28-followup-kpis strong{display:block;margin-top:6px;font-size:1.05rem;line-height:1.35;color:var(--text,#eef3ee)}.v28-followup-kpis article:nth-child(2) strong{color:#f3b562}.v28-followup-kpis article:nth-child(3) strong{color:#64d8cf}.v28-followup-kpis article small{display:block;margin-top:4px;color:var(--text-muted,#8f9793);font-size:.72rem}.v28-followup-chart-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.v28-followup-chart{min-width:0;padding:14px;border:1px solid var(--line,#29312e);border-radius:15px;background:color-mix(in srgb,var(--surface-2,#111816) 90%,transparent)}.v28-followup-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.v28-followup-section-head h3{margin:3px 0 0;font-size:1rem}.v28-followup-section-head p{margin:4px 0 0;color:var(--text-muted,#9ba39f);line-height:1.45}.v28-followup-row-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.v28-followup-row-head strong{font-size:.82rem}.v28-followup-row-head b{font-size:.78rem;color:#b9ff59}.v28-followup-score-row+.v28-followup-score-row,.v28-followup-composition-row+.v28-followup-composition-row{margin-top:16px}.v28-followup-score-row small,.v28-followup-area-row small{display:block;margin-top:6px;color:var(--text-muted,#8f9793);font-size:.7rem;line-height:1.35}.v28-followup-track{height:10px;margin-top:8px;border-radius:999px;background:color-mix(in srgb,var(--line,#29312e) 80%,transparent);overflow:hidden}.v28-followup-track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#64d8cf,#b9ff59)}.v28-followup-track.is-thin{height:7px;margin-top:5px}.v28-followup-stack{display:flex;height:13px;margin-top:9px;border-radius:999px;background:var(--line,#29312e);overflow:hidden}.v28-followup-stack span{display:block;height:100%;min-width:0}.v28-followup-stack .is-correct,.v28-followup-legend .is-correct{background:#b9ff59}.v28-followup-stack .is-wrong,.v28-followup-legend .is-wrong{background:#f3b562}.v28-followup-stack .is-invalid,.v28-followup-legend .is-invalid{background:#f08b8b}.v28-followup-legend{display:flex;flex-wrap:wrap;gap:7px 10px;margin-top:8px;color:var(--text-muted,#9ba39f);font-size:.68rem}.v28-followup-legend span{display:inline-flex;align-items:center;gap:4px}.v28-followup-legend i{display:inline-block;width:7px;height:7px;border-radius:50%}.v28-followup-area-exam+.v28-followup-area-exam{margin-top:18px;padding-top:16px;border-top:1px solid var(--line,#29312e)}.v28-followup-area-row{margin-top:11px}.v28-followup-area-row>div:first-child{display:flex;justify-content:space-between;gap:8px;font-size:.72rem}.v28-followup-area-row b{color:#64d8cf}.v28-followup-timeline{padding-top:2px;border-top:1px solid var(--line,#29312e)}.v28-followup-milestones{display:grid;gap:9px}.v28-followup-milestone{display:grid;grid-template-columns:12px minmax(0,1fr);gap:9px;align-items:start;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--line,#29312e) 70%,transparent)}.v28-followup-milestone-dot{width:10px;height:10px;margin-top:4px;border-radius:50%;background:#8f9793;box-shadow:0 0 0 4px color-mix(in srgb,#8f9793 10%,transparent)}.v28-followup-milestone--done .v28-followup-milestone-dot{background:#b9ff59;box-shadow:0 0 0 4px color-mix(in srgb,#b9ff59 10%,transparent)}.v28-followup-milestone--current .v28-followup-milestone-dot{background:#f3b562;box-shadow:0 0 0 4px color-mix(in srgb,#f3b562 10%,transparent)}.v28-followup-milestone--upcoming .v28-followup-milestone-dot{background:#64d8cf;box-shadow:0 0 0 4px color-mix(in srgb,#64d8cf 10%,transparent)}.v28-followup-milestone .v28-followup-row-head b{color:var(--text-muted,#9ba39f);font-size:.68rem}.v28-followup-milestone--current .v28-followup-row-head b{color:#f3b562}.v28-followup-milestone small{display:block;margin-top:4px;color:var(--text-muted,#9ba39f);font-size:.72rem;line-height:1.4}.v28-followup-disclosure{padding-top:11px;border-top:1px solid var(--line,#29312e)}.v28-followup-disclosure summary{cursor:pointer;list-style:none;font-size:.82rem;font-weight:800}.v28-followup-disclosure summary::-webkit-details-marker{display:none}.v28-followup-disclosure summary:after{content:" +";color:var(--text-muted,#8f9793);font-weight:500}.v28-followup-disclosure[open] summary:after{content:" −"}.v28-followup-resource-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:11px}.v28-followup-resource{padding:12px;border:1px solid var(--line,#29312e);border-radius:13px;background:var(--surface-2,#111816)}.v28-followup-resource p{margin:5px 0;color:var(--text-muted,#9ba39f);font-size:.75rem}.v28-followup-resource-metrics{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;color:var(--text-muted,#9ba39f);font-size:.7rem}.v28-followup-resource-metrics b{color:#64d8cf}.v28-followup-resource>small{display:block;line-height:1.4}.v28-followup-note{margin:10px 0 0;color:var(--text-muted,#9ba39f);font-size:.76rem;line-height:1.5}.v28-followup-note b{color:var(--text,#eef3ee)}.v28-followup-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:11px}.v28-followup-link{color:#64d8cf;font-size:.76rem;text-decoration:none}.v28-followup-link:hover{text-decoration:underline}.v28-followup-empty{color:var(--text-muted,#8f9793);font-size:.76rem}.v28-preexam-ready{padding-top:14px;border-top:1px solid var(--line,#29312e)}.v28-preexam-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,.7fr);gap:14px}.v28-preexam-checklist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0 0;padding:0;list-style:none}.v28-preexam-checklist li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:start;padding:9px;border:1px solid var(--line,#29312e);border-radius:11px;background:var(--surface-2,#111816)}.v28-preexam-checklist li>span{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;color:#64d8cf;background:color-mix(in srgb,#64d8cf 10%,transparent);font-size:.65rem;font-weight:800}.v28-preexam-checklist strong{display:block;font-size:.74rem}.v28-preexam-checklist small{display:block;margin-top:3px;color:var(--text-muted,#8f9793);font-size:.68rem;line-height:1.35}.v28-preexam-output{display:flex;align-content:start;flex-wrap:wrap;gap:7px;padding:12px;border:1px solid color-mix(in srgb,#64d8cf 35%,var(--line,#29312e));border-radius:13px;background:color-mix(in srgb,#64d8cf 5%,transparent)}.v28-preexam-output>span{width:100%;margin-bottom:2px;color:var(--text-muted,#9ba39f);font-size:.72rem}.v28-preexam-output>b{padding:6px 8px;border:1px solid var(--line,#29312e);border-radius:999px;color:#64d8cf;font-size:.68rem;font-weight:700}.v28-preexam-standby{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:start;margin-top:16px}.v28-preexam-standby h3{margin:4px 0;font-size:1rem}.v28-preexam-standby p{margin:0;color:var(--text-muted,#9ba39f);font-size:.78rem;line-height:1.45}.v28-standby-tags{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:7px}.v28-standby-tags span{padding:6px 8px;border:1px solid var(--line,#29312e);border-radius:999px;color:var(--text-muted,#9ba39f);font-size:.68rem}@media(max-width:1050px){.v28-followup-chart-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v28-followup-chart--areas{grid-column:1/-1}}@media(max-width:760px){.v28-followup-header,.v28-followup-section-head{display:block}.v28-followup-status{margin-top:10px}.v28-followup-kpis{grid-template-columns:1fr}.v28-followup-chart-grid{grid-template-columns:1fr}.v28-followup-chart--areas{grid-column:auto}.v28-followup-resource-grid,.v28-preexam-grid{grid-template-columns:1fr}.v28-preexam-checklist{grid-template-columns:1fr}.v28-preexam-standby{grid-template-columns:1fr}.v28-standby-tags{grid-column:auto}}';
    document.head.appendChild(style);
  }

  function patchPostExam(data) {
    const root = document.querySelector('[data-post-exam-v27]');
    if (!root) return false;
    const html = followUpMarkup(data);
    if (!html) return false;
    let node = root.querySelector('[data-v28-post-followup]');
    if (!node) {
      const anchor = root.querySelector('.v27-next-panel') || root.firstElementChild;
      if (anchor) anchor.insertAdjacentHTML('afterend', html);
      return true;
    }
    const signature = followUpSignature(data);
    if (node.dataset.v28FollowupSignature !== signature) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const replacement = wrapper.firstElementChild;
      if (replacement) node.replaceWith(replacement);
    }
    return true;
  }

  function patchHome(data) {
    if (document.querySelector('[data-post-exam-v27]')) return;
    const root = document.querySelector('.command-view');
    if (!root) return;
    const html = standbyMarkup(data);
    if (!html) return;
    let node = root.querySelector('[data-v28-preexam-standby]');
    const anchor = root.querySelector('[data-v28-transition-console]') || root.querySelector('.command-grid');
    if (!node && anchor) {
      anchor.insertAdjacentHTML('afterend', html);
    }
  }

  function patch(data = snapshot) {
    if (data) snapshot = data;
    if (!snapshot || snapshot.meta?.phase !== 'post-exam') return;
    ensureStyles();
    if (!patchPostExam(snapshot)) patchHome(snapshot);
  }

  function schedule(data = snapshot) {
    if (data) snapshot = data;
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      patch(snapshot);
    });
  }

  async function load() {
    try {
      const response = await fetch('data/snapshot.json?postExamFollowUp=' + Date.now(), { cache: 'no-store' });
      if (response.ok) snapshot = await response.json();
    } catch {}
    schedule(snapshot);
  }

  window.addEventListener('plano:snapshot-loaded', (event) => schedule(event.detail || snapshot));
  window.addEventListener('hashchange', () => window.setTimeout(() => schedule(), 0));
  window.addEventListener('popstate', () => window.setTimeout(() => schedule(), 0));
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-refresh]') || event.target.closest('[data-exam-day-tab]')) window.setTimeout(load, 700);
  });

  const observer = new MutationObserver(() => schedule());
  function start() {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    schedule();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
