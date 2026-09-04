function closeMoreSheetForExamDay() {
  const sheet = document.getElementById('moreSheet');
  const backdrop = document.getElementById('moreBackdrop');
  sheet?.classList.remove('open');
  sheet?.setAttribute('aria-hidden', 'true');
  backdrop?.classList.add('hidden');
  if (document.getElementById('commandPalette')?.classList.contains('hidden')) document.body.classList.remove('modal-open');
}

function syncExamDayShell() {
  const active = location.hash === '#exam-day';
  document.body.classList.toggle('exam-day-active', active);
  if (active) closeMoreSheetForExamDay();
}

document.addEventListener('click', event => {
  if (!event.target.closest('[data-exam-day-tab]')) return;
  // Fecha imediatamente o sheet antes de renderizar/navegar para evitar sobreposição e condição de corrida.
  closeMoreSheetForExamDay();
  document.body.classList.add('exam-day-active');
  window.setTimeout(syncExamDayShell, 0);
});

window.addEventListener('hashchange', syncExamDayShell);
window.addEventListener('popstate', syncExamDayShell);

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncExamDayShell, { once: true });
else syncExamDayShell();
