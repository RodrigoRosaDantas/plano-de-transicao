/* Dia da Prova v22 — microinterações visuais, sem alterar conteúdo ou regras */
(() => {
  const SECTIONS = ['exam21Summary','exam21Turns','exam21Checklist','exam21Rules','exam21Sources'];

  function shell() {
    return document.querySelector('.exam21-shell');
  }

  function setActiveSubnav(id) {
    document.querySelectorAll('.exam21-subnav [data-exam21-scroll]').forEach(button => {
      const active = button.dataset.exam21Scroll === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  function syncChecklistVisual() {
    const progress = document.getElementById('exam21Progress');
    const checks = [...document.querySelectorAll('#exam21Checks input[type="checkbox"]')];
    if (!progress || !checks.length) return;
    const done = checks.filter(input => input.checked).length;
    progress.classList.toggle('is-complete', done === checks.length);
    progress.setAttribute('title', done === checks.length ? 'Checklist concluído' : `${done} de ${checks.length} itens conferidos`);
  }

  function bindSectionObserver() {
    if (!shell() || shell().dataset.polishV22 === '1') return;
    shell().dataset.polishV22 = '1';

    const nodes = SECTIONS.map(id => document.getElementById(id)).filter(Boolean);
    if (!nodes.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a,b) => Math.abs(a.boundingClientRect.top - 150) - Math.abs(b.boundingClientRect.top - 150));
        if (visible[0]?.target?.id) setActiveSubnav(visible[0].target.id);
      }, { rootMargin: '-24% 0px -58% 0px', threshold: [0,.15,.4] });
      nodes.forEach(node => observer.observe(node));
    }

    setActiveSubnav(nodes[0].id);
    syncChecklistVisual();
  }

  document.addEventListener('change', event => {
    if (event.target.closest('#exam21Checks')) window.setTimeout(syncChecklistVisual, 0);
  });

  document.addEventListener('click', event => {
    if (event.target.closest('[data-exam21-all],[data-exam21-clear]')) window.setTimeout(syncChecklistVisual, 0);
  });

  const observer = new MutationObserver(() => {
    if (location.hash === '#exam-day') bindSectionObserver();
  });

  const start = () => {
    if (document.body) observer.observe(document.body, { childList:true, subtree:true });
    if (location.hash === '#exam-day') bindSectionObserver();
  };

  window.addEventListener('hashchange', () => {
    if (location.hash === '#exam-day') window.setTimeout(bindSectionObserver, 0);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
