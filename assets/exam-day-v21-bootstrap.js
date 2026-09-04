(() => {
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
