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
    return Boolean(exam?.scoreTracking?.preliminary || exam?.scoreTracking?.definitive);
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

  function formatNumber(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return Number(value).toLocaleString('pt-BR');
  }

  function formatPct(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }

  function answerVector(response) {
    return Object.entries(response?.answers || {})
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([number, answer]) => `${String(number).padStart(2, '0')}=${answer || 'INVÁLIDA'}`)
      .join(' · ');
  }


  function auditState(id, data = snapshot) {
    const exam = sedesExam(id, data);
    const root = data?.postExam?.scoring?.[id] || {};
    const definitive = root.definitive || null;
    const preliminary = root.preliminary || null;
    return { exam, response: exam?.candidateResponse || null, root, definitive, preliminary, active: definitive || preliminary };
  }

  function auditStatusLabel(status) {
    return {
      acerto: 'Acerto',
      erro: 'Erro',
      'inválida-ou-em-branco': 'Inválida / em branco',
      anulada: 'Anulada'
    }[status] || 'Não classificada';
  }

  function auditStatusClass(status) {
    return String(status || 'unknown').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  }

  function auditCandidateLabel(item, response) {
    if (item?.audit?.candidateLabel) return item.audit.candidateLabel;
    if (item?.candidate) return item.candidate;
    if ((response?.invalidQuestions || []).map(Number).includes(Number(item?.question))) return 'DUPLA-MARCAÇÃO';
    return 'SEM-RESPOSTA';
  }

  function auditDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date).replace(',', ' ·');
  }

  function auditLink(href, label) {
    return href ? '<a class="v28-audit-link" href="' + esc(href) + '" target="_blank" rel="noreferrer">' + esc(label) + ' ↗</a>' : '';
  }

  function auditMarkup(id, data = snapshot) {
    const state = auditState(id, data);
    const active = state.active;
    const response = state.response || {};
    const questions = active?.questions || [];
    if (!active || !questions.length) return '';

    const differences = active.differences || questions.filter(item => item.status !== 'acerto');
    const isPreliminary = !state.definitive;
    const audit = active.audit || {};
    const documents = {
      keyPdfUrl: 'https://anexos-r2.selecao.net.br/uploads/861/concursos/3056/anexos/9ecbb8fd-f3b7-4bc7-a1a8-3b64b5f38752.pdf',
      justificationsPdfUrl: 'https://anexos-r2.selecao.net.br/uploads/861/concursos/3056/anexos/a6ca1138-66c1-4d2a-b0c0-04ad7285c239.pdf',
      resourceNoticePdfUrl: 'https://anexos-r2.selecao.net.br/uploads/861/concursos/3056/anexos/bd001ca2-91ab-4291-ac42-aab7f0399170.pdf',
      ...(audit.sourceDocuments || {})
    };
    const protocol = audit.resourceReview?.protocol || {};
    const candidateSource = audit.responseSource || response.source || 'Registro de respostas anotadas pelo candidato';
    const keyLabel = audit.keyLabel || (isPreliminary ? 'Gabarito preliminar oficial' : 'Gabarito definitivo oficial');
    const scoreLabel = isPreliminary ? 'Nota objetiva estimada' : 'Nota objetiva definitiva';
    const rawScore = state.exam?.score || '—';
    const rawAccuracy = state.exam?.rawAccuracy;
    const questionRows = questions.map(item => {
      const candidate = auditCandidateLabel(item, response);
      const status = auditStatusLabel(item.status);
      const reason = item.audit?.resultReason || (item.status === 'acerto'
        ? 'A resposta anotada coincide com a chave usada.'
        : item.status === 'erro'
          ? 'A resposta anotada diverge da chave usada.'
          : 'O registro não contém uma marcação válida para pontuar.');
      const basis = item.audit?.officialBasis || '';
      const appeal = item.audit?.appealAssessment || null;
      const candidateNote = item.audit?.candidateNote || '';
      const review = item.status === 'acerto'
        ? ''
        : '<div class="v28-audit-basis"><b>Leitura:</b> ' + esc(reason) + '</div>'
          + (basis ? '<div class="v28-audit-basis"><b>Justificativa preliminar:</b> ' + esc(basis) + '</div>' : '')
          + (appeal ? '<div class="v28-audit-appeal"><b>Recurso:</b> ' + esc(appeal.label || 'avaliar') + '. ' + esc(appeal.recommendation || '') + '</div>' : '');
      return '<tr class="v28-audit-row v28-audit-row--' + auditStatusClass(item.status) + '">'
        + '<td data-label="Q">' + esc(String(item.question).padStart(2, '0')) + '</td>'
        + '<td data-label="Área">' + esc(item.areaLabel || item.area || '—') + '</td>'
        + '<td data-label="Sua anotação"><strong>' + esc(candidate) + '</strong>' + (candidateNote ? '<small>' + esc(candidateNote) + '</small>' : '') + '</td>'
        + '<td data-label="Chave preliminar"><strong>' + esc(item.official || '—') + '</strong></td>'
        + '<td data-label="Resultado"><span class="v28-audit-status v28-audit-status--' + auditStatusClass(item.status) + '">' + esc(status) + '</span></td>'
        + '<td data-label="Pontos"><strong>' + esc(item.points) + '/' + esc(item.pointsPossible) + '</strong></td>'
        + '<td data-label="Motivo" class="v28-audit-reading"><div>' + esc(reason) + '</div>' + review + '</td>'
        + '</tr>';
    }).join('');

    const appealCards = differences.map(item => {
      const candidate = auditCandidateLabel(item, response);
      const appeal = item.audit?.appealAssessment || {
        label: item.status === 'inválida-ou-em-branco' ? 'Só avaliar eventual anulação' : 'Não priorizar só pela divergência',
        recommendation: 'Só protocolar se houver fundamento objetivo no enunciado, no edital, nas alternativas ou na fonte normativa.'
      };
      const basis = item.audit?.officialBasis || '';
      const candidateNote = item.audit?.candidateNote || '';
      return '<article class="v28-audit-appeal-item v28-audit-appeal-item--' + auditStatusClass(item.status) + '">'
        + '<div class="v28-audit-appeal-head"><strong>Q' + esc(item.question) + '</strong><span>' + esc(item.areaLabel || item.area || '—') + ' · ' + esc(item.pointsPossible) + ' ponto(s) em disputa</span></div>'
        + '<p><b>Sua anotação:</b> ' + esc(candidate) + ' · <b>gabarito preliminar:</b> ' + esc(item.official || '—') + (candidateNote ? ' · ' + esc(candidateNote) : '') + '</p>'
        + (basis ? '<p><b>O que a banca fundamentou:</b> ' + esc(basis) + '</p>' : '<p><b>O que foi comparado:</b> ' + esc(item.audit?.resultReason || 'A anotação foi comparada com a chave preliminar.') + '</p>')
        + '<p><b>Pré-análise:</b> ' + esc(appeal.label || 'avaliar') + '. ' + esc(appeal.recommendation || '') + '</p>'
        + '</article>';
    }).join('');

    const protocolText = protocol.start && protocol.end
      ? auditDateTime(protocol.start) + ' a ' + auditDateTime(protocol.end) + ' (horário de Brasília)'
      : 'Período conforme comunicado oficial';
    const keyDate = active.publishedAt ? formatDate(active.publishedAt) : '—';
    const links = auditLink(documents.keyPdfUrl, 'Gabarito preliminar PDF')
      + auditLink(documents.justificationsPdfUrl, 'Justificativas da banca')
      + auditLink(documents.resourceNoticePdfUrl, 'Comunicado de recursos');

    return '<div class="v28-audit-intro">'
      + '<div class="v28-audit-head"><div><span class="eyebrow">AUDITORIA QUESTÃO A QUESTÃO</span><h4>' + esc(state.exam?.role || id.toUpperCase()) + ' · Tipo ' + esc(active.examType || state.exam?.examType || '—') + '</h4><p>Cruzamento entre as respostas anotadas na prova/registro do candidato e o gabarito preliminar oficial da Quadrix.</p></div><span class="v28-audit-stage">' + esc(keyLabel) + '</span></div>'
      + '<div class="v28-audit-warning"><strong>Fontes separadas:</strong> suas respostas anotadas vêm do registro pós-prova e <b>não são gabarito oficial</b>. A chave usada nesta auditoria foi o <b>gabarito preliminar</b>, publicado em ' + esc(keyDate) + ', ainda sujeito a recurso e alteração.</div>'
      + '<div class="v28-audit-source-grid">'
      + '<article><span>SUAS RESPOSTAS</span><strong>Anotadas na prova</strong><small>' + esc(candidateSource) + '</small><small>Não substituem o cartão-resposta oficial.</small></article>'
      + '<article><span>CHAVE USADA</span><strong>' + esc(keyLabel) + '</strong><small>Instituto Quadrix · publicação ' + esc(keyDate) + '</small><small>Resultado definitivo ainda pendente.</small></article>'
      + '</div>'
      + '<div class="v28-audit-kpis">'
      + '<article><strong>' + esc(active.correct) + '</strong><small>acertos</small></article>'
      + '<article><strong>' + esc(active.wrong) + '</strong><small>erros</small></article>'
      + '<article><strong>' + esc(active.invalid) + '</strong><small>inválidas/em branco</small></article>'
      + '<article><strong>' + esc(active.totalScore) + '/100</strong><small>' + esc(scoreLabel) + '</small></article>'
      + '</div>'
      + '<div class="v28-audit-score-note"><b>Leitura da pontuação:</b> o registro bruto anotado é ' + esc(rawScore) + ' (' + esc(formatPct(rawAccuracy)) + '), mas a nota do concurso é ponderada: ' + esc(active.generalScore) + '/20 em conhecimentos gerais + ' + esc(active.specificScore) + '/80 em conhecimentos específicos.</div>'
      + '<details class="v28-audit-disclosure"><summary>Ver o cruzamento das ' + esc(questions.length) + ' questões</summary><div class="v28-audit-table-wrap"><table class="v28-audit-table"><thead><tr><th>Q</th><th>Área</th><th>Sua anotação</th><th>Chave</th><th>Resultado</th><th>Pontos</th><th>Motivo / leitura</th></tr></thead><tbody>' + questionRows + '</tbody></table></div></details>'
      + '<details class="v28-audit-disclosure v28-audit-resources"><summary>Pré-análise de recursos · ' + esc(differences.length) + ' divergência(s)</summary><div class="v28-audit-resource-callout"><strong>Conclusão provisória:</strong> diferença entre a sua anotação e a chave, sozinha, não prova erro da banca. O recurso deve ser individualizado e apontar vício objetivo para alteração do gabarito ou anulação. Para a Q30 do TDAS, a dupla marcação é um problema de registro da resposta; eventual recurso teria de pedir anulação do item, não trocar a sua marcação.</div><div class="v28-audit-appeal-list">' + (appealCards || '<p class="v28-audit-empty">Nenhuma divergência registrada nesta etapa.</p>') + '</div><div class="v28-audit-protocol"><b>Janela oficial:</b> ' + esc(protocolText) + '. <b>Canal:</b> sistema eletrônico da Quadrix, na área do candidato. Para objetiva, é um recurso por questão e não são aceitos anexos.</div></details>'
      + '<div class="v28-audit-links"><span>Documentos oficiais:</span>' + links + '</div>'
      + '</div>';
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
      .v28-answer-audit{margin-top:14px;padding-top:14px;border-top:1px solid var(--line,#29312e)}
      .v28-audit-intro{display:grid;gap:12px}
      .v28-audit-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
      .v28-audit-head h4{margin:4px 0;font-size:1.05rem}
      .v28-audit-head p{margin:0;color:var(--text-muted,#8f9793);line-height:1.45}
      .v28-audit-stage{padding:6px 9px;border:1px solid color-mix(in srgb,#f3b562 45%,var(--line,#29312e));border-radius:999px;color:#f3b562;font-size:.72rem;font-weight:800;white-space:nowrap}
      .v28-audit-warning{padding:12px 14px;border:1px solid color-mix(in srgb,#f3b562 38%,var(--line,#29312e));border-radius:13px;background:color-mix(in srgb,#f3b562 7%,var(--surface-2,#111816));color:var(--text-muted,#9ba39f);font-size:.8rem;line-height:1.55}
      .v28-audit-warning strong,.v28-audit-warning b{color:var(--text,#eef3ee)}
      .v28-audit-source-grid,.v28-audit-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .v28-audit-source-grid article,.v28-audit-kpis article{padding:12px;border:1px solid var(--line,#29312e);border-radius:13px;background:color-mix(in srgb,var(--surface-2,#111816) 88%,transparent)}
      .v28-audit-source-grid span,.v28-audit-kpis small{display:block;color:var(--text-muted,#8f9793);font-size:.68rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
      .v28-audit-source-grid strong{display:block;margin:4px 0;font-size:.9rem}
      .v28-audit-source-grid small{display:block;color:var(--text-muted,#8f9793);font-size:.75rem;line-height:1.4}
      .v28-audit-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
      .v28-audit-kpis article{background:var(--surface-2,#111816)}
      .v28-audit-kpis strong{display:block;font-size:1.35rem;line-height:1.1}
      .v28-audit-kpis article:nth-child(1) strong{color:#b9ff59}
      .v28-audit-kpis article:nth-child(2) strong{color:#f3b562}
      .v28-audit-kpis article:nth-child(3) strong{color:#f08b8b}
      .v28-audit-kpis article:nth-child(4) strong{color:#64d8cf}
      .v28-audit-score-note{padding:11px 13px;border-left:3px solid #64d8cf;color:var(--text-muted,#9ba39f);font-size:.78rem;line-height:1.5;background:color-mix(in srgb,#64d8cf 5%,transparent)}
      .v28-audit-score-note b{color:var(--text,#eef3ee)}
      .v28-audit-disclosure{border-top:1px solid var(--line,#29312e);padding-top:10px}
      .v28-audit-disclosure summary{cursor:pointer;list-style:none;color:var(--text,#eef3ee);font-size:.8rem;font-weight:800}
      .v28-audit-disclosure summary::-webkit-details-marker{display:none}
      .v28-audit-disclosure summary:after{content:" +";color:var(--text-muted,#8f9793);font-weight:500}
      .v28-audit-disclosure[open] summary:after{content:" −"}
      .v28-audit-table-wrap{margin-top:10px;overflow:auto;border:1px solid var(--line,#29312e);border-radius:12px}
      .v28-audit-table{width:100%;min-width:980px;border-collapse:collapse;font-size:.73rem}
      .v28-audit-table th{padding:9px 8px;text-align:left;color:var(--text-muted,#8f9793);font-size:.65rem;letter-spacing:.05em;text-transform:uppercase;background:var(--surface-2,#111816)}
      .v28-audit-table td{padding:9px 8px;border-top:1px solid var(--line,#29312e);vertical-align:top;line-height:1.4}
      .v28-audit-table td small{display:block;margin-top:4px;color:var(--text-muted,#8f9793);font-size:.68rem}
      .v28-audit-row--erro{background:color-mix(in srgb,#f3b562 5%,transparent)}
      .v28-audit-row--invalida-ou-em-branco{background:color-mix(in srgb,#f08b8b 6%,transparent)}
      .v28-audit-row--anulada{background:color-mix(in srgb,#64d8cf 6%,transparent)}
      .v28-audit-status{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:.64rem;font-weight:800;white-space:nowrap}
      .v28-audit-status--acerto{color:#b9ff59;background:color-mix(in srgb,#b9ff59 10%,transparent)}
      .v28-audit-status--erro{color:#f3b562;background:color-mix(in srgb,#f3b562 10%,transparent)}
      .v28-audit-status--invalida-ou-em-branco{color:#f08b8b;background:color-mix(in srgb,#f08b8b 10%,transparent)}
      .v28-audit-status--anulada{color:#64d8cf;background:color-mix(in srgb,#64d8cf 10%,transparent)}
      .v28-audit-reading{min-width:285px;color:var(--text-muted,#a7afab)}
      .v28-audit-basis{margin-top:5px;color:var(--text-muted,#9ba39f)}
      .v28-audit-basis b,.v28-audit-appeal b{color:var(--text,#eef3ee)}
      .v28-audit-appeal{margin-top:6px;padding:7px 8px;border-left:2px solid #f3b562;color:#f3c98f}
      .v28-audit-resource-callout{margin-top:10px;padding:12px 14px;border:1px solid color-mix(in srgb,#f3b562 38%,var(--line,#29312e));border-radius:12px;background:color-mix(in srgb,#f3b562 6%,transparent);color:var(--text-muted,#9ba39f);font-size:.78rem;line-height:1.5}
      .v28-audit-resource-callout strong{color:#f3c98f}
      .v28-audit-appeal-list{display:grid;gap:8px;margin-top:10px}
      .v28-audit-appeal-item{padding:11px 12px;border:1px solid var(--line,#29312e);border-radius:12px;background:var(--surface-2,#111816);font-size:.76rem;line-height:1.5}
      .v28-audit-appeal-item--invalida-ou-em-branco{border-color:color-mix(in srgb,#f08b8b 45%,var(--line,#29312e))}
      .v28-audit-appeal-head{display:flex;align-items:baseline;gap:8px}
      .v28-audit-appeal-head strong{color:#f3b562}
      .v28-audit-appeal-head span{color:var(--text-muted,#8f9793);font-size:.68rem}
      .v28-audit-appeal-item p{margin:5px 0 0;color:var(--text-muted,#a7afab)}
      .v28-audit-appeal-item b{color:var(--text,#eef3ee)}
      .v28-audit-empty{color:var(--text-muted,#8f9793);font-size:.8rem}
      .v28-audit-links{display:flex;align-items:center;flex-wrap:wrap;gap:9px;color:var(--text-muted,#8f9793);font-size:.72rem}
      .v28-audit-link{color:#64d8cf;text-decoration:none}
      .v28-audit-link:hover{text-decoration:underline}
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
      setText(detail, 'Aguardando gabarito oficial publicado');
    }

    let note = card.querySelector(`[data-v28-score-note="${id}"]`);
    if (!note) {
      note = document.createElement('p');
      note.dataset.v28ScoreNote = id;
      note.className = 'v27-archive-note';
      result.insertAdjacentElement('afterend', note);
    }
    if (id === 'tdas' && (response.invalidQuestions || []).includes(30)) {
      setText(note, 'Q30: dupla marca no cartão; vale 0 ponto no cenário preliminar, salvo eventual anulação da questão pela banca.');
    } else if (id === 'edas') {
      setText(note, preliminary ? 'EDAS 400 · Tipo A: correção preliminar baseada no gabarito da Quadrix. Resultado oficial ainda pendente.' : 'EDAS 400: respostas do candidato registradas; este registro não é gabarito oficial.');
    } else {
      setText(note, preliminary ? 'TDAS 202 · Tipo B: correção preliminar baseada no gabarito da Quadrix. Resultado oficial ainda pendente.' : 'Respostas do candidato registradas para cruzamento com o gabarito oficial.');
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

    const activeAudit = auditState(id, data).active;
    const auditQuestions = activeAudit?.questions || [];
    let audit = card.querySelector(`[data-v28-answer-audit="${id}"]`);
    if (!audit && auditQuestions.length) {
      audit = document.createElement('section');
      audit.className = 'v28-answer-audit';
      audit.dataset.v28AnswerAudit = id;
      vector.insertAdjacentElement('afterend', audit);
    }
    if (audit && auditQuestions.length) {
      const auditSignature = JSON.stringify({
        stage: activeAudit.stage,
        comparedAt: activeAudit.comparedAt,
        total: activeAudit.totalScore,
        rows: auditQuestions.map(item => [item.question, item.candidate, item.official, item.status, item.audit?.officialBasis || ''])
      });
      if (audit.dataset.v28AuditSignature !== auditSignature) {
        audit.innerHTML = auditMarkup(id, data);
        audit.dataset.v28AuditSignature = auditSignature;
      }
    }
  }

  function stageModel(data = snapshot) {
    const edas = sedesExam('edas', data);
    const tdas = sedesExam('tdas', data);
    const edasState = scoreState('edas', data);
    const tdasState = scoreState('tdas', data);
    const preliminary = edasState.preliminary || tdasState.preliminary;
    const definitive = edasState.definitive || tdasState.definitive;
    const anyCorrection = Boolean(hasCorrection(edas) || hasCorrection(tdas));
    const anyRanking = hasRanking(edas) || hasRanking(tdas);
    const hasOfficialKey = Boolean(preliminary || definitive);

    return [
      { label: 'Provas', detail: '2 de 2 realizadas', state: 'done' },
      { label: 'Gabarito', detail: hasOfficialKey ? 'preliminar incorporado' : 'aguardando banca', state: hasOfficialKey ? 'done' : 'current' },
      { label: 'Correção', detail: anyCorrection ? 'cruzamento preliminar disponível' : 'depois do gabarito', state: anyCorrection ? 'done' : hasOfficialKey ? 'current' : 'pending' },
      { label: 'Recursos', detail: definitive ? 'janela encerrada/definitivo' : preliminary ? 'conferir itens recorríveis' : 'após correção', state: definitive ? 'done' : preliminary ? 'current' : 'pending' },
      { label: 'Resultado', detail: anyRanking ? 'classificação registrada' : definitive ? 'acompanhar classificação' : 'aguardando etapas oficiais', state: anyRanking ? 'done' : definitive ? 'current' : 'pending' },
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
    if (window.__PLANO_SEPARATE_POST_EXAM__) return;
    const root = document.querySelector('.command-view');
    if (!root || data?.meta?.phase !== 'post-exam') return;
    ensureStyles();

    const reading = data?.postExam?.competitionReading;
    const signature = JSON.stringify({
      generatedAt: data?.meta?.generatedAt || null,
      stages: stageModel(data).map(({ label, detail, state }) => [label, detail, state]),
      competition: reading ? {
        auditedAt: reading.auditedAt,
        tdas: reading.exams?.tdas?.preliminaryScore,
        edas: reading.exams?.edas?.preliminaryScore,
        tdasRate: reading.exams?.tdas?.nominalCorrectionRateAC,
        edasRate: reading.exams?.edas?.nominalCorrectionRateAC
      } : null
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

  function patchDedicated(data = snapshot) {
    if (!window.__PLANO_SEPARATE_POST_EXAM__ || data?.meta?.phase !== 'post-exam') return;
    const root = document.querySelector('[data-post-exam-page]');
    if (!root) return;
    ensureStyles();
    const reading = data?.postExam?.competitionReading;
    const signature = JSON.stringify({
      generatedAt: data?.meta?.generatedAt || null,
      stages: stageModel(data).map(({ label, detail, state }) => [label, detail, state]),
      competition: reading ? {
        auditedAt: reading.auditedAt,
        tdas: reading.exams?.tdas?.preliminaryScore,
        edas: reading.exams?.edas?.preliminaryScore,
        tdasRate: reading.exams?.tdas?.nominalCorrectionRateAC,
        edasRate: reading.exams?.edas?.nominalCorrectionRateAC
      } : null
    });
    let consoleNode = root.querySelector(':scope > [data-v28-transition-console]');
    if (consoleNode?.dataset.v28Signature === signature) return;
    if (!consoleNode) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = transitionConsole(data).trim();
      const replacement = wrapper.firstElementChild;
      if (!replacement) return;
      replacement.dataset.v28Signature = signature;
      const followup = root.querySelector(':scope > [data-v28-post-followup]');
      if (followup) followup.insertAdjacentElement('beforebegin', replacement);
      else root.prepend(replacement);
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.innerHTML = transitionConsole(data).trim();
    const replacement = wrapper.firstElementChild;
    if (replacement) {
      replacement.dataset.v28Signature = signature;
      consoleNode.replaceWith(replacement);
    }
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
    patchDedicated(snapshot);
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